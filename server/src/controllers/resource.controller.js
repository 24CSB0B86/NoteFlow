'use strict';

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/db');
const { enqueueJob, getJobStatus: _getJobStatus } = require('../services/fileProcessor');
const { awardKarma } = require('../services/karmaEngine');
const analyticsCtrl = require('./analytics.controller');

// ── Allowed file types ────────────────────────────────────────────────────────
const ALLOWED_TYPES = {
  'application/pdf': { ext: 'pdf', maxSize: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', maxSize: 20 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', maxSize: 50 * 1024 * 1024 },
  'image/jpeg': { ext: 'jpg', maxSize: 10 * 1024 * 1024 },
  'image/png': { ext: 'png', maxSize: 10 * 1024 * 1024 },
  'image/gif': { ext: 'gif', maxSize: 10 * 1024 * 1024 },
  'image/webp': { ext: 'webp', maxSize: 10 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', maxSize: 100 * 1024 * 1024 },
};

// ── Multer (memory storage – we stream to Supabase) ───────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB absolute cap
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ── Helper: get signed URL ────────────────────────────────────────────────────
async function _getSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Signed URL error: ${error.message}`);
  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/resources/upload
// ─────────────────────────────────────────────────────────────────────────────
const uploadResource = [
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file provided' });

      const { syllabus_node_id, classroom_id, doc_type, year, tags, description } = req.body;
      console.log(`[Resource] POST /upload – file: "${file?.originalname}" size: ${file?.size} classroom: ${classroom_id} user: ${req.user.id}`);

      if (!syllabus_node_id || !classroom_id) {
        console.warn('[Resource] Upload rejected – missing syllabus_node_id or classroom_id');
        return res.status(400).json({ error: 'syllabus_node_id and classroom_id are required' });
      }

      // Validate type & size
      const typeInfo = ALLOWED_TYPES[file.mimetype];
      if (!typeInfo) return res.status(400).json({ error: 'File type not allowed' });
      if (file.size > typeInfo.maxSize) {
        return res.status(400).json({
          error: `File too large. Max size for ${typeInfo.ext.toUpperCase()} is ${typeInfo.maxSize / (1024 * 1024)}MB`,
        });
      }

      // Verify user is a member of the classroom
      const memberCheck = await query(
        `SELECT 1 FROM classroom_members WHERE classroom_id = $1 AND user_id = $2
         UNION SELECT 1 FROM classrooms WHERE id = $1 AND professor_id = $2`,
        [classroom_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not a member of this classroom' });
      }

      const resourceId = uuidv4();
      const filePath = `resources/${classroom_id}/${syllabus_node_id}/${resourceId}.${typeInfo.ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('resources')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Check for existing resource with same name → version control
      const existingRes = await query(
        `SELECT id FROM resources
         WHERE syllabus_node_id = $1 AND classroom_id = $2 AND file_name = $3
         LIMIT 1`,
        [syllabus_node_id, classroom_id, file.originalname]
      );

      let finalResourceId;
      let versionNumber = 1;

      if (existingRes.rows.length > 0) {
        // Version control: increment version, archive current
        finalResourceId = existingRes.rows[0].id;
        // Unset current version
        await query(
          `UPDATE file_versions SET is_current = FALSE WHERE resource_id = $1 AND is_current = TRUE`,
          [finalResourceId]
        );
        // Get next version number
        const nextVersion = await query(
          `SELECT get_next_version($1) AS next`, [finalResourceId]
        );
        versionNumber = nextVersion.rows[0].next;
        // Update resource record
        await query(
          `UPDATE resources SET uploader_id = $1, file_url = $2, processing_status = 'pending',
           file_type = $3, file_size = $4, version = $5 WHERE id = $6`,
          [req.user.id, filePath, file.mimetype, file.size, versionNumber, finalResourceId]
        );
      } else {
        // New resource
        finalResourceId = resourceId;
        await query(
          `INSERT INTO resources (id, syllabus_node_id, classroom_id, uploader_id, file_name,
           file_url, file_type, file_size, version, processing_status, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','{}')`,
          [finalResourceId, syllabus_node_id, classroom_id, req.user.id,
           file.originalname, filePath, file.mimetype, file.size, versionNumber]
        );
      }

      // Insert new file_version record
      await query(
        `INSERT INTO file_versions (resource_id, version_number, file_path, file_size, is_current)
         VALUES ($1,$2,$3,$4,TRUE)`,
        [finalResourceId, versionNumber, filePath, file.size]
      );

      // Insert/update file_metadata
      const tagsArray = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];
      await query(
        `INSERT INTO file_metadata (resource_id, doc_type, year, tags, description)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (resource_id) DO UPDATE
         SET doc_type=$2, year=$3, tags=$4, description=$5`,
        [finalResourceId, doc_type || 'other', year || null, JSON.stringify(tagsArray), description || null]
      );

      // Enqueue background processing (thumbnail, preview, metadata extraction)
      const jobId = uuidv4();
      enqueueJob(jobId, finalResourceId, file.buffer, file.mimetype, file.originalname);

      // Award karma for upload (non-blocking)
      awardKarma(req.user.id, 'upload', finalResourceId, `Uploaded "${file.originalname}"`).catch(() => {});
      // Track analytics event (non-blocking)
      analyticsCtrl.trackEvent(classroom_id, req.user.id, 'upload', finalResourceId);

      console.log(`[Resource] ✅ Upload complete – resourceId: ${finalResourceId} version: ${versionNumber} jobId: ${jobId}`);
      res.status(201).json({
        success: true,
        resourceId: finalResourceId,
        jobId,
        version: versionNumber,
        message: versionNumber > 1 ? `Version ${versionNumber} uploaded` : 'File uploaded successfully',
      });
    } catch (err) {
      console.error('[Resource] ❌ Upload error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/resources/:nodeId
// ─────────────────────────────────────────────────────────────────────────────
const getResources = async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { doc_type, year, search, sort = 'newest' } = req.query;
    console.log(`[Resource] GET /node/${nodeId} – sort: ${sort} doc_type: ${doc_type} search: "${search}"`);
    let whereClause = 'r.syllabus_node_id = $1';
    const params = [nodeId];
    let paramIdx = 2;

    if (doc_type) {
      whereClause += ` AND fm.doc_type = $${paramIdx++}`;
      params.push(doc_type);
    }
    if (year) {
      whereClause += ` AND fm.year = $${paramIdx++}`;
      params.push(parseInt(year));
    }
    if (search) {
      whereClause += ` AND (r.file_name ILIKE $${paramIdx} OR fm.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const orderMap = {
      newest: 'r.created_at DESC',
      oldest: 'r.created_at ASC',
      name: 'r.file_name ASC',
      downloads: 'r.download_count DESC',
    };
    const orderBy = orderMap[sort] || orderMap.newest;

    const result = await query(
      `SELECT r.id, r.file_name, r.file_type, r.file_size, r.version, r.is_verified,
              r.processing_status, r.download_count, r.created_at,
              u.full_name AS uploader_name,
              fm.doc_type, fm.year, fm.tags, fm.description, fm.page_count,
              fv.thumbnail_path, fv.preview_path, fv.file_path
       FROM resources r
       LEFT JOIN users u ON u.id = r.uploader_id
       LEFT JOIN file_metadata fm ON fm.resource_id = r.id
       LEFT JOIN file_versions fv ON fv.resource_id = r.id AND fv.is_current = TRUE
       WHERE ${whereClause}
       ORDER BY ${orderBy}`,
      params
    );

    // Generate signed thumbnail URLs
    const resources = await Promise.all(result.rows.map(async (row) => {
      let thumbnailUrl = null;
      if (row.thumbnail_path) {
        try { thumbnailUrl = await _getSignedUrl('thumbnails', row.thumbnail_path, 3600); }
        catch (e) { /* skip */ }
      }
      return { ...row, thumbnailUrl };
    }));

    console.log(`[Resource] ✅ getResources – returned ${resources.length} resources for node ${nodeId}`);
    res.json({ resources });
  } catch (err) {
    console.error('[Resource] ❌ getResources error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/versions
// ─────────────────────────────────────────────────────────────────────────────
const getVersionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT fv.*, u.full_name AS uploader_name
       FROM file_versions fv
       JOIN resources r ON r.id = fv.resource_id
       LEFT JOIN users u ON u.id = r.uploader_id
       WHERE fv.resource_id = $1
       ORDER BY fv.version_number DESC`,
      [id]
    );
    res.json({ versions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/resources/:id/rollback/:versionId  (Professor only)
// ─────────────────────────────────────────────────────────────────────────────
const rollbackVersion = async (req, res) => {
  try {
    if (req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Only professors can rollback versions' });
    }
    const { id, versionId } = req.params;

    const versionCheck = await query(
      `SELECT * FROM file_versions WHERE id = $1 AND resource_id = $2`,
      [versionId, id]
    );
    if (versionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const version = versionCheck.rows[0];

    // Unset all current, set the target version as current
    await query(`UPDATE file_versions SET is_current = FALSE WHERE resource_id = $1`, [id]);
    await query(`UPDATE file_versions SET is_current = TRUE WHERE id = $1`, [versionId]);

    // Update main resource record
    await query(
      `UPDATE resources SET file_url = $1, version = $2 WHERE id = $3`,
      [version.file_path, version.version_number, id]
    );

    res.json({ success: true, message: `Rolled back to version ${version.version_number}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/resources/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Resource] DELETE /${id} – by user: ${req.user.id} role: ${req.user.role}`);
    const resource = await query(
      `SELECT * FROM resources WHERE id = $1`, [id]
    );
    if (resource.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const r = resource.rows[0];
    // RBAC: professor can delete any, student can only delete own
    if (req.user.role === 'student' && r.uploader_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own uploads' });
    }

    // Delete all storage files
    const versions = await query(`SELECT file_path FROM file_versions WHERE resource_id = $1`, [id]);
    for (const v of versions.rows) {
      await supabaseAdmin.storage.from('resources').remove([v.file_path]).catch(() => {});
    }
    // Delete thumbnails and previews
    await supabaseAdmin.storage.from('thumbnails').remove([`thumbnails/${id}/thumb.png`]).catch(() => {});
    await supabaseAdmin.storage.from('previews').remove([`previews/${id}/preview.pdf`]).catch(() => {});

    // Delete DB record (cascades to versions, metadata)
    await query(`DELETE FROM resources WHERE id = $1`, [id]);
    console.log(`[Resource] ✅ Deleted resource ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Resource] ❌ deleteResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/download
// ─────────────────────────────────────────────────────────────────────────────
const downloadResource = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT r.file_url, r.file_name, fv.file_path
       FROM resources r
       LEFT JOIN file_versions fv ON fv.resource_id = r.id AND fv.is_current = TRUE
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const filePath = result.rows[0].file_path || result.rows[0].file_url;
    const signedUrl = await _getSignedUrl('resources', filePath, 300); // 5 min
    console.log(`[Resource] ✅ Download URL generated for resource ${id}`);

    // Increment download count and track event
    await query(`UPDATE resources SET download_count = download_count + 1 WHERE id = $1`, [id]);
    await analyticsCtrl.trackEvent(result.rows[0].classroom_id, req.user?.id, 'download', id);

    res.json({ url: signedUrl, fileName: result.rows[0].file_name });
  } catch (err) {
    console.error('[Resource] ❌ downloadResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/preview
// ─────────────────────────────────────────────────────────────────────────────
const getPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT fv.preview_path, fv.file_path, r.file_type
       FROM file_versions fv
       JOIN resources r ON r.id = fv.resource_id
       WHERE fv.resource_id = $1 AND fv.is_current = TRUE`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const { preview_path, file_path, file_type } = result.rows[0];
    const bucket = preview_path ? 'previews' : 'resources';
    const path = preview_path || file_path;
    const signedUrl = await _getSignedUrl(bucket, path, 3600);

    // Increment view_count + track event
    await query(`UPDATE resources SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`, [id]).catch(() => {});
    const classRes = await query(`SELECT classroom_id FROM resources WHERE id = $1`, [id]).catch(() => null);
    if (classRes?.rows[0]) {
      analyticsCtrl.trackEvent(classRes.rows[0].classroom_id, req.user?.id, 'view', id);
    }

    res.json({ url: signedUrl, fileType: file_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/job-status
// ─────────────────────────────────────────────────────────────────────────────
const getJobStatus = async (req, res) => {
  const { id } = req.params;
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId query param required' });
  const status = _getJobStatus(jobId);
  // Also fetch DB status as fallback
  const dbResult = await query(`SELECT processing_status FROM resources WHERE id = $1`, [id]).catch(() => null);
  const dbStatus = dbResult?.rows[0]?.processing_status;
  res.json({ ...status, dbStatus });
};

module.exports = {
  uploadResource,
  getResources,
  getVersionHistory,
  rollbackVersion,
  deleteResource,
  downloadResource,
  getPreview,
  getJobStatus,
};
