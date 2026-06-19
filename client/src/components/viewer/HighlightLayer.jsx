import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

const COLORS = ['#facc15', '#f87171', '#4ade80', '#60a5fa', '#c084fc', '#fb923c']

export default function HighlightLayer({
  resourceId, pageNumber, pageWidth, pageHeight,
  highlights, onHighlightAdded, onHighlightDeleted,
}) {
  const [picker, setPicker] = useState(null) // { x, y, coords, text }
  const [saving, setSaving] = useState(false)

  // ── Global mouseup: detect text selection anywhere in the PDF viewer ──────
  useEffect(() => {
    const handleMouseUp = (e) => {
      // Small delay so browser finishes updating selection
      setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()
        if (!text || selection.isCollapsed) {
          setPicker(null)
          return
        }

        // Only trigger inside the PDF viewer area
        const pdfArea = document.querySelector('.react-pdf__Document')
        if (!pdfArea) return

        // Find which page the selection is in
        const range = selection.getRangeAt(0)
        const pageEl = range.commonAncestorContainer?.parentElement?.closest('.react-pdf__Page')
          || document.querySelector('.react-pdf__Page') // fallback to first page

        // Get normalized coords relative to the page
        const rects = range.getClientRects()
        let coords = { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.15 }
        if (rects.length > 0 && pageEl) {
          const pageRect = pageEl.getBoundingClientRect()
          const r = rects[0]
          coords = {
            x1: Math.max(0, (r.left - pageRect.left) / pageRect.width),
            y1: Math.max(0, (r.top - pageRect.top) / pageRect.height),
            x2: Math.min(1, (r.right - pageRect.left) / pageRect.width),
            y2: Math.min(1, (r.bottom - pageRect.top) / pageRect.height),
          }
        }

        // Show picker at cursor position (fixed on screen)
        setPicker({
          x: e.clientX,
          y: e.clientY,
          coords,
          text,
        })
      }, 50)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [pageNumber])

  const saveHighlight = useCallback(async (color) => {
    if (!picker || saving) return
    setSaving(true)
    try {
      const { data } = await api.post('/api/highlights', {
        resource_id: resourceId,
        page_number: pageNumber,
        coordinates: picker.coords,
        text_content: picker.text,
        color,
      })
      onHighlightAdded?.(data.highlight)
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      console.error('Failed to save highlight:', err.message)
    } finally {
      setSaving(false)
      setPicker(null)
    }
  }, [picker, saving, resourceId, pageNumber, onHighlightAdded])

  const deleteHighlight = useCallback(async (id) => {
    try {
      await api.delete(`/api/highlights/${id}`)
      onHighlightDeleted?.(id)
    } catch (err) {
      console.error('Failed to delete highlight:', err.message)
    }
  }, [onHighlightDeleted])

  return (
    <>
      {/* ── Saved highlight boxes ─────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{ width: pageWidth, height: pageHeight }}>
        {highlights.map((h) => {
          const x = h.coordinates.x1 * pageWidth
          const y = h.coordinates.y1 * pageHeight
          const w = Math.max((h.coordinates.x2 - h.coordinates.x1) * pageWidth, 20)
          const ht = Math.max((h.coordinates.y2 - h.coordinates.y1) * pageHeight, 8)
          return (
            <div
              key={h.id}
              className="absolute rounded-sm cursor-pointer"
              style={{
                left: x, top: y, width: w, height: ht,
                backgroundColor: h.color || '#facc15',
                opacity: 0.4,
                pointerEvents: 'all',
              }}
              title={`"${h.text_content || 'Highlight'}" — right-click to delete`}
              onContextMenu={(e) => { e.preventDefault(); deleteHighlight(h.id) }}
            />
          )
        })}
      </div>

      {/* ── Floating color picker (fixed to viewport) ─────────────────── */}
      {picker && (
        <div
          className="fixed z-[9999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl px-3 py-2.5 flex items-center gap-2"
          style={{
            left: Math.min(picker.x, window.innerWidth - 220),
            top: picker.y + 12,
            pointerEvents: 'all',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-gray-500 font-medium mr-1">Highlight</span>
          {COLORS.map((c) => (
            <button
              key={c}
              disabled={saving}
              onClick={() => saveHighlight(c)}
              className="w-6 h-6 rounded-full border-2 border-transparent hover:scale-125 transition-transform focus:outline-none focus:border-gray-800"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <button
            onClick={() => { setPicker(null); window.getSelection()?.removeAllRanges() }}
            className="ml-1 text-gray-400 hover:text-gray-700 text-lg leading-none"
            title="Cancel"
          >×</button>
        </div>
      )}
    </>
  )
}
