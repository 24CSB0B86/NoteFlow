'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { query } = require('../config/db');

// ── In-memory processing queue ────────────────────────────────────────────────
// jobId → { status: 'pending'|'processing'|'done'|'failed', error? }
const jobQueue = new Map();

/**
 * Enqueue a background processing job.
 * Returns immediately; processing happens asynchronously.
 */
function enqueueJob(jobId, resourceId, fileBuffer, mimeType, originalName) {
  jobQueue.set(jobId, { status: 'pending' });
  // Run in next tick so HTTP response goes out first
  setImmediate(() => _processFile(jobId, resourceId, fileBuffer, mimeType, originalName));
}

/**
 * Get the processing status of a job.
 */
function getJobStatus(jobId) {
  return jobQueue.get(jobId) || { status: 'not_found' };
}

// ── Core processing pipeline ──────────────────────────────────────────────────
async function _processFile(jobId, resourceId, fileBuffer, mimeType, originalName) {
  jobQueue.set(jobId, { status: 'processing' });
  try {
    let thumbnailPath = null;
    let previewPath = null;
    let pageCount = null;
    let pdfTitle = null;
    let pdfAuthor = null;

    // ── 1. Process by file type ──────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      const result = await _processPdf(resourceId, fileBuffer);
      thumbnailPath = result.thumbnailPath;
      previewPath = result.previewPath;
      pageCount = result.pageCount;
      pdfTitle = result.title;
      pdfAuthor = result.author;
    } else if (mimeType.startsWith('image/')) {
      thumbnailPath = await _processImage(resourceId, fileBuffer);
    } else {
      // DOCX, PPTX, video – generate a text-card placeholder thumbnail
      thumbnailPath = await _generatePlaceholderThumbnail(resourceId, originalName, mimeType);
    }

    // ── 2. Update file_versions with thumbnail/preview paths ─────────────────
    await query(
      `UPDATE file_versions
       SET thumbnail_path = $1, preview_path = $2
       WHERE resource_id = $3 AND is_current = TRUE`,
      [thumbnailPath, previewPath, resourceId]
    );

    // ── 3. Update file_metadata with extracted info ───────────────────────────
    await query(
      `UPDATE file_metadata
       SET page_count = $1, author = $2, pdf_title = $3
       WHERE resource_id = $4`,
      [pageCount, pdfAuthor, pdfTitle, resourceId]
    );

    // ── 4. Mark resource as done ─────────────────────────────────────────────
    await query(
      `UPDATE resources SET processing_status = 'done' WHERE id = $1`,
      [resourceId]
    );

    jobQueue.set(jobId, { status: 'done', thumbnailPath, previewPath });
    console.log(`✅ Processing done: ${jobId}`);
  } catch (err) {
    console.error(`❌ Processing failed for job ${jobId}:`, err.message);
    await query(
      `UPDATE resources SET processing_status = 'failed' WHERE id = $1`,
      [resourceId]
    ).catch(() => {});
    jobQueue.set(jobId, { status: 'failed', error: err.message });
  }
}

// ── PDF Processing ────────────────────────────────────────────────────────────
async function _processPdf(resourceId, fileBuffer) {
  let pageCount = null;
  let title = null;
  let author = null;
  let thumbnailPath = null;
  let previewPath = null;

  // Extract metadata using pdf-lib
  try {
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
    title = pdfDoc.getTitle() || null;
    author = pdfDoc.getAuthor() || null;

    // Generate compressed preview (< 2MB target) if original > 1MB
    if (fileBuffer.length > 1_000_000) {
      previewPath = await _generatePdfPreview(resourceId, fileBuffer, pdfDoc);
    }
  } catch (e) {
    console.warn(`⚠️  pdf-lib parse warning for ${resourceId}:`, e.message);
  }

  // Generate SVG-based placeholder thumbnail (no native deps needed)
  thumbnailPath = await _generatePdfThumbnail(resourceId, pageCount);

  return { thumbnailPath, previewPath, pageCount, title, author };
}

// Generate a stylized SVG thumbnail card, upload to Supabase thumbnails bucket
async function _generatePdfThumbnail(resourceId, pageCount) {
  const pages = pageCount ? `${pageCount} pages` : 'PDF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="200" height="260" rx="12" fill="url(#g)"/>
  <rect x="20" y="20" width="160" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="32" width="120" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="44" width="140" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="56" width="100" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="68" width="130" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="80" width="110" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
  <rect x="20" y="100" width="160" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
  <rect x="20" y="112" width="120" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
  <rect x="20" y="124" width="140" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
  <rect x="60" y="165" width="80" height="60" rx="6" fill="rgba(255,255,255,0.15)"/>
  <text x="100" y="200" font-family="Arial,sans-serif" font-size="22" font-weight="bold"
        fill="white" text-anchor="middle">PDF</text>
  <text x="100" y="218" font-family="Arial,sans-serif" font-size="11"
        fill="rgba(255,255,255,0.8)" text-anchor="middle">${pages}</text>
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const path = `thumbnails/${resourceId}/thumb.png`;
  const { error } = await supabaseAdmin.storage
    .from('thumbnails')
    .upload(path, pngBuffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
  return path;
}

// Compress PDF using pdf-lib (remove unnecessary objects, flatten)
async function _generatePdfPreview(resourceId, fileBuffer, existingDoc) {
  try {
    const doc = existingDoc || await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    // pdf-lib doesn't do lossy compression, but re-saving strips some bloat
    const compressedBytes = await doc.save({ useObjectStreams: true });
    if (compressedBytes.length >= fileBuffer.length) return null; // no gain

    const path = `previews/${resourceId}/preview.pdf`;
    const { error } = await supabaseAdmin.storage
      .from('previews')
      .upload(path, Buffer.from(compressedBytes), { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`Preview upload failed: ${error.message}`);
    return path;
  } catch (e) {
    console.warn('⚠️  Preview generation skipped:', e.message);
    return null;
  }
}

// ── Image Processing ──────────────────────────────────────────────────────────
async function _processImage(resourceId, fileBuffer) {
  const thumbBuffer = await sharp(fileBuffer)
    .resize(200, 260, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();
  const path = `thumbnails/${resourceId}/thumb.png`;
  const { error } = await supabaseAdmin.storage
    .from('thumbnails')
    .upload(path, thumbBuffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Image thumbnail upload failed: ${error.message}`);
  return path;
}

// ── Placeholder thumbnail for DOCX, PPTX, Video ──────────────────────────────
async function _generatePlaceholderThumbnail(resourceId, fileName, mimeType) {
  const ext = fileName.split('.').pop().toUpperCase().slice(0, 4);
  const colors = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['#3b82f6', '#1d4ed8'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['#f59e0b', '#d97706'],
    'video/mp4': ['#ec4899', '#be185d'],
    'video/mpeg': ['#ec4899', '#be185d'],
  };
  const [c1, c2] = colors[mimeType] || ['#64748b', '#475569'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="260" rx="12" fill="url(#g)"/>
  <rect x="60" y="80" width="80" height="100" rx="8" fill="rgba(255,255,255,0.2)"/>
  <text x="100" y="142" font-family="Arial,sans-serif" font-size="20" font-weight="bold"
        fill="white" text-anchor="middle">${ext}</text>
</svg>`;
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const path = `thumbnails/${resourceId}/thumb.png`;
  const { error } = await supabaseAdmin.storage
    .from('thumbnails')
    .upload(path, pngBuffer, { contentType: 'image/png', upsert: true });
  if (error) console.warn('Placeholder thumbnail upload warning:', error.message);
  return path;
}

module.exports = { enqueueJob, getJobStatus };
