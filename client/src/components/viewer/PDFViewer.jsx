import { useState, useRef, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Download, Search, X, Loader2, AlertCircle, BookOpen, FileX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ── Page Skeleton ─────────────────────────────────────────────────────────────
function PageSkeleton({ width, height }) {
  return (
    <div
      className="bg-muted/30 animate-pulse rounded-sm mx-auto"
      style={{ width: width || 612, height: height || 792 }}
    />
  )
}

// ── Thumbnail Strip Item ──────────────────────────────────────────────────────
function ThumbnailItem({ pageNumber, currentPage, onSelect, pdf }) {
  return (
    <button
      onClick={() => onSelect(pageNumber)}
      className={cn(
        'group relative w-full border-2 rounded-lg overflow-hidden transition-all cursor-pointer',
        currentPage === pageNumber
          ? 'border-primary shadow-lg shadow-primary/20'
          : 'border-border/40 hover:border-primary/50'
      )}
    >
      <Document file={pdf} loading={<div className="h-20 bg-muted/30 animate-pulse" />}>
        <Page
          pageNumber={pageNumber}
          width={110}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
      <div className={cn(
        'absolute bottom-0 left-0 right-0 py-0.5 text-xs font-medium text-center',
        currentPage === pageNumber ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-muted-foreground'
      )}>
        {pageNumber}
      </div>
    </button>
  )
}

// ── Main PDF Viewer ───────────────────────────────────────────────────────────
export default function PDFViewer({ fileUrl, fileName, onPageChange, overlayRef }) {
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbs, setShowThumbs] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [visiblePages, setVisiblePages] = useState(new Set([1]))

  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const pageRefs = useRef({})
  const observerRef = useRef(null)

  const ZOOM_STEP = 0.25
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3.0

  // ── Intersection Observer for lazy loading ────────────────────────────────
  useEffect(() => {
    if (!numPages) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const page = parseInt(entry.target.dataset.page)
          if (entry.isIntersecting) {
            setVisiblePages((prev) => new Set([...prev, page]))
            setCurrentPage(page)
            onPageChange?.(page)
          }
        })
      },
      { threshold: 0.3, root: viewerRef.current }
    )
    Object.values(pageRefs.current).forEach((el) => {
      if (el) observerRef.current.observe(el)
    })
    return () => observerRef.current?.disconnect()
  }, [numPages, onPageChange])

  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => {
    setNumPages(n)
    setLoadError(null)
    setVisiblePages(new Set([1, 2, 3]))
  }, [])

  const onDocumentLoadError = useCallback((err) => {
    setLoadError(err.message || 'Failed to load PDF')
  }, [])

  const goToPage = useCallback((page) => {
    const clamped = Math.max(1, Math.min(numPages, page))
    setCurrentPage(clamped)
    pageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onPageChange?.(clamped)
  }, [numPages, onPageChange])

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const pageWidth = Math.round(650 * zoom)

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8">
        <FileX className="w-16 h-16 text-destructive/60" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Failed to load PDF</p>
          <p className="text-sm mt-1">{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-background',
        isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80 backdrop-blur shrink-0 flex-wrap">
        {/* Thumbnail toggle */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowThumbs((v) => !v)}
          title="Toggle thumbnail panel"
        >
          <BookOpen className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-border" />

        {/* Page navigation */}
        <Button size="icon" variant="ghost" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            className="w-14 h-7 text-center text-sm"
            value={currentPage}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v)) goToPage(v)
            }}
          />
          <span className="text-sm text-muted-foreground">/ {numPages || '…'}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-border" />

        {/* Zoom */}
        <Button size="icon" variant="ghost" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-border" />

        {/* Search toggle */}
        <Button size="icon" variant="ghost" onClick={() => setShowSearch((v) => !v)} title="Search in PDF">
          <Search className="w-4 h-4" />
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/40 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Search within PDF… (uses browser Ctrl+F)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 h-7 text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
          />
          <span className="text-xs text-muted-foreground">Use Ctrl+F for native search</span>
          <button onClick={() => setShowSearch(false)}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* ── Body: Thumbnails + Pages ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Thumbnail Sidebar */}
        {showThumbs && (
          <div className="w-32 border-r border-border bg-card/50 overflow-y-auto shrink-0 p-2 space-y-2">
            {numPages && Array.from({ length: Math.min(numPages, 50) }, (_, i) => i + 1).map((pg) => (
              <ThumbnailItem
                key={pg}
                pageNumber={pg}
                currentPage={currentPage}
                onSelect={goToPage}
                pdf={fileUrl}
              />
            ))}
            {numPages > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{numPages - 50} more pages
              </p>
            )}
          </div>
        )}

        {/* Main PDF area */}
        <div ref={viewerRef} className="flex-1 overflow-y-auto bg-muted/20 relative">
          <div className="py-6 space-y-4 flex flex-col items-center">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center gap-3 py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading PDF…</p>
                </div>
              }
              error={
                <div className="flex items-center gap-2 text-destructive py-20">
                  <AlertCircle className="w-5 h-5" />
                  <span>Failed to load document</span>
                </div>
              }
            >
              {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
                <div
                  key={pg}
                  ref={(el) => { pageRefs.current[pg] = el }}
                  data-page={pg}
                  className="relative shadow-2xl shadow-black/40 rounded-sm mx-auto"
                  style={{ width: pageWidth, marginBottom: 16 }}
                >
                  {visiblePages.has(pg) ? (
                    <>
                      <Page
                        pageNumber={pg}
                        width={pageWidth}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        loading={<PageSkeleton width={pageWidth} height={Math.round(pageWidth * 1.294)} />}
                      />
                      {/* Overlay slot – heatmap and highlights always rendered so OverlayInjector can find them */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        id={`pdf-overlay-page-${pg}`}
                        data-page-num={pg}
                        style={{ width: pageWidth, height: Math.round(pageWidth * 1.294) }}
                      />
                    </>
                  ) : (
                    <PageSkeleton width={pageWidth} height={Math.round(pageWidth * 1.294)} />
                  )}
                </div>
              ))}
            </Document>
          </div>
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div className="px-4 py-1 border-t border-border bg-card/80 text-xs text-muted-foreground flex items-center gap-4 shrink-0">
        <span>{fileName}</span>
        {numPages && <span>{numPages} pages</span>}
        <span>{Math.round(zoom * 100)}% zoom</span>
        {pageLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </div>
    </div>
  )
}
