import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Thermometer, Download, Loader2,
  AlertCircle, Flame, Eye, EyeOff, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Layout from '@/components/Layout'
import PDFViewer from '@/components/viewer/PDFViewer'
import HeatmapOverlay from '@/components/viewer/HeatmapOverlay'
import HighlightLayer from '@/components/viewer/HighlightLayer'
import DiscussionSidebar from '@/components/viewer/DiscussionSidebar'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

export default function ResourceViewerPage() {
  const { classroomId, resourceId } = useParams()
  const navigate = useNavigate()

  const [resource, setResource] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Viewer state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState({ width: 650, height: 842 })

  // Feature toggles
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showDiscussions, setShowDiscussions] = useState(false)
  const [showHighlights, setShowHighlights] = useState(true)

  // Heatmap & highlights
  const [heatmapZones, setHeatmapZones] = useState([])
  const [heatmapHighlightCount, setHeatmapHighlightCount] = useState(0)
  const [ownHighlights, setOwnHighlights] = useState([]) // for current page

  const heatmapPollRef = useRef(null)

  // ── Fetch resource + preview URL ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // Fetch resource preview URL
        const { data } = await api.get(`/api/resources/${resourceId}/preview`)
        setPreviewUrl(data.url)

        // Also get highlights for initial page
        fetchHighlights(1)
        fetchHeatmap(1)
      } catch (err) {
        setError(err.response?.data?.error || err.message)
      } finally { setLoading(false) }
    }
    init()
  }, [resourceId])

  // ── Fetch heatmap for current page ────────────────────────────────────────
  const fetchHeatmap = useCallback(async (page) => {
    try {
      const { data } = await api.get(`/api/highlights/heatmap/${resourceId}/${page}`)
      setHeatmapZones(data.zones || [])
      setHeatmapHighlightCount(data.highlightCount || 0)
    } catch (err) {
      console.error('Heatmap fetch error:', err.message)
    }
  }, [resourceId])

  // ── Fetch own highlights for current page ─────────────────────────────────
  const fetchHighlights = useCallback(async (page) => {
    try {
      const { data } = await api.get(`/api/highlights/${resourceId}?page=${page}`)
      setOwnHighlights(data.own || [])
    } catch (err) {
      console.error('Highlights fetch error:', err.message)
    }
  }, [resourceId])

  // ── Page change handler ────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
    fetchHighlights(page)
    if (showHeatmap) fetchHeatmap(page)
  }, [fetchHighlights, fetchHeatmap, showHeatmap])

  // ── Heatmap polling when enabled (30s) ────────────────────────────────────
  useEffect(() => {
    if (!showHeatmap) {
      clearInterval(heatmapPollRef.current)
      return
    }
    fetchHeatmap(currentPage)
    heatmapPollRef.current = setInterval(() => fetchHeatmap(currentPage), 30000)
    return () => clearInterval(heatmapPollRef.current)
  }, [showHeatmap, currentPage, fetchHeatmap])

  const handleHighlightAdded = useCallback((newHighlight) => {
    setOwnHighlights((prev) => [...prev, newHighlight])
    // Refresh heatmap after adding highlight
    setTimeout(() => fetchHeatmap(currentPage), 5500) // wait for debounce
  }, [currentPage, fetchHeatmap])

  const handleHighlightDeleted = useCallback((id) => {
    setOwnHighlights((prev) => prev.filter((h) => h.id !== id))
    setTimeout(() => fetchHeatmap(currentPage), 5500)
  }, [currentPage, fetchHeatmap])

  const handleDownload = async () => {
    try {
      const { data } = await api.get(`/api/resources/${resourceId}/download`)
      const a = document.createElement('a')
      a.href = data.url
      a.download = data.fileName
      a.click()
    } catch (err) { console.error(err) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading viewer…</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold">Failed to load resource</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </div>
      </Layout>
    )
  }

  const zoom = 1.0
  const pageWidth = Math.round(650 * zoom)
  const pageHeight = Math.round(pageWidth * 1.294)

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80 backdrop-blur shrink-0">
        <Link
          to={`/classrooms/${classroomId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
        <span className="text-sm font-medium truncate flex-1">Document Viewer</span>

        <div className="flex items-center gap-2 ml-auto">
          {/* Highlight toggle */}
          <Button
            size="sm"
            variant={showHighlights ? 'default' : 'outline'}
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowHighlights((v) => !v)}
            title="Toggle your highlights"
          >
            {showHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Highlights
          </Button>

          {/* Heatmap toggle */}
          <Button
            size="sm"
            variant={showHeatmap ? 'default' : 'outline'}
            className={cn('h-8 text-xs gap-1.5', showHeatmap && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500')}
            onClick={() => setShowHeatmap((v) => !v)}
            title="Toggle class heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            Heatmap
            {heatmapHighlightCount > 0 && showHeatmap && (
              <span className="bg-white/20 rounded-full px-1.5">{heatmapHighlightCount}</span>
            )}
          </Button>

          {/* Discussion toggle */}
          <Button
            size="sm"
            variant={showDiscussions ? 'default' : 'outline'}
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowDiscussions((v) => !v)}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Discuss
          </Button>

          {/* Download */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main content: PDF + overlays + sidebar ──────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PDF area with overlay layers */}
        <div className="flex-1 relative overflow-hidden">
          {previewUrl ? (
            <div className="h-full relative">
              <PDFViewer
                fileUrl={previewUrl}
                fileName="Document"
                onPageChange={handlePageChange}
              />

              {/* Overlay layers rendered on top of PDF pages */}
              {/* We use portal-style injection into pdf-overlay-page-* divs */}
              <OverlayInjector
                currentPage={currentPage}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                heatmapZones={heatmapZones}
                showHeatmap={showHeatmap}
                heatmapHighlightCount={heatmapHighlightCount}
                ownHighlights={ownHighlights}
                showHighlights={showHighlights}
                resourceId={resourceId}
                onHighlightAdded={handleHighlightAdded}
                onHighlightDeleted={handleHighlightDeleted}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">Preview not available</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" /> Download File
                </Button>
              </div>
            </div>
          )}

          {/* Heatmap legend (when heatmap is on) */}
          {showHeatmap && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur border border-border rounded-full px-4 py-1.5 text-xs text-muted-foreground shadow-lg pointer-events-none z-10">
              <span>Low</span>
              <div className="w-24 h-2 rounded-full" style={{
                background: 'linear-gradient(to right, rgba(0,0,255,0.5), rgba(255,255,0,0.6), rgba(255,0,0,0.7))'
              }} />
              <span>High</span>
              <span className="ml-2 text-foreground font-medium">{heatmapHighlightCount} highlights</span>
            </div>
          )}
        </div>

        {/* Discussion Sidebar */}
        <DiscussionSidebar
          resourceId={resourceId}
          currentPage={currentPage}
          visible={showDiscussions}
          onClose={() => setShowDiscussions(false)}
        />
      </div>
    </div>
  )
}

// ── Overlay Injector using createPortal into PDF page slots ───────────────────
import { createPortal } from 'react-dom'

function OverlayInjector({
  currentPage, pageWidth, pageHeight,
  heatmapZones, showHeatmap, heatmapHighlightCount,
  ownHighlights, showHighlights,
  resourceId, onHighlightAdded, onHighlightDeleted,
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Wait for PDF to render pages
    const timer = setTimeout(() => setMounted(true), 800)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) return null

  // Find all rendered page overlay slots
  const slots = document.querySelectorAll('[id^="pdf-overlay-page-"]')

  return (
    <>
      {Array.from(slots).map((slot) => {
        const pg = parseInt(slot.dataset.pageNum)
        if (!pg) return null

        const pageHighlights = ownHighlights.filter(h => h.page_number === pg)

        return createPortal(
          <div className="absolute inset-0 pointer-events-none" style={{ width: pageWidth, height: pageHeight }}>
            {/* Heatmap canvas overlay */}
            {showHeatmap && pg === currentPage && (
              <div className="pointer-events-none absolute inset-0">
                <HeatmapOverlay
                  zones={heatmapZones}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  visible={showHeatmap}
                  highlightCount={heatmapHighlightCount}
                />
              </div>
            )}
            {/* Highlight selection layer */}
            {showHighlights && (
              <div className="pointer-events-auto absolute inset-0">
                <HighlightLayer
                  resourceId={resourceId}
                  pageNumber={pg}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  highlights={pageHighlights}
                  onHighlightAdded={onHighlightAdded}
                  onHighlightDeleted={onHighlightDeleted}
                />
              </div>
            )}
          </div>,
          slot
        )
      })}
    </>
  )
}
