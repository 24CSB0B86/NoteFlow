/**
 * HighlightLayer — PDF text highlight overlay
 *
 * Architecture (correct approach):
 * - React-pdf renders: <canvas> (visual) + <div.textLayer> (selectable spans) inside <div.react-pdf__Page>
 * - We portal an overlay div (sibling of react-pdf__Page) via PDFViewer's overlay slot
 * - Text selection happens normally in the text layer (pointer-events: none on our overlay)
 * - On mouseup we read window.getSelection(), compute each line rect as % of the page rect
 * - We store an array of rects (one per line) — accurate even for multi-line selections
 * - We render highlight boxes using CSS % so they scale with zoom automatically
 * - Color picker is position:fixed so it always appears near the cursor
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

const COLORS = [
  { hex: '#facc15', label: 'Yellow' },
  { hex: '#f87171', label: 'Red'    },
  { hex: '#4ade80', label: 'Green'  },
  { hex: '#60a5fa', label: 'Blue'   },
  { hex: '#c084fc', label: 'Purple' },
  { hex: '#fb923c', label: 'Orange' },
]

/** Convert a ClientRect to percentages relative to the page element's bounding rect */
function toPercent(clientRect, pageRect) {
  return {
    left:   (clientRect.left   - pageRect.left) / pageRect.width,
    top:    (clientRect.top    - pageRect.top)  / pageRect.height,
    width:  clientRect.width   / pageRect.width,
    height: clientRect.height  / pageRect.height,
  }
}

export default function HighlightLayer({
  resourceId,
  pageNumber,
  highlights,
  onHighlightAdded,
  onHighlightDeleted,
}) {
  const [picker, setPicker]   = useState(null) // { screenX, screenY, rects, text }
  const [saving, setSaving]   = useState(false)

  // ── Listen for text selection anywhere on the document ─────────────────────
  useEffect(() => {
    const onMouseUp = (e) => {
      // Don't interfere with clicks on our own color picker
      if (e.target.closest('[data-hl-picker]')) return

      // Small delay so browser finishes building the selection
      requestAnimationFrame(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount) return

        const text = sel.toString().trim()
        if (!text) return

        const range = sel.getRangeAt(0)

        // Find the react-pdf page element that owns this selection
        // react-pdf adds data-page-number on the .react-pdf__Page div
        const anchor = sel.anchorNode?.nodeType === Node.TEXT_NODE
          ? sel.anchorNode.parentElement
          : sel.anchorNode
        const pageEl = anchor?.closest?.('.react-pdf__Page')
        if (!pageEl) return

        // Make sure it's OUR page (HighlightLayer is instantiated per page)
        const renderedPageNum = parseInt(pageEl.dataset.pageNumber, 10)
        if (renderedPageNum !== pageNumber) return

        const pageRect = pageEl.getBoundingClientRect()

        // Get all individual line rects — handles multi-line selections correctly
        const lineRects = Array.from(range.getClientRects())
          .filter(r => r.width > 1 && r.height > 1) // skip zero-size rects
          .map(r => toPercent(r, pageRect))

        if (!lineRects.length) return

        setPicker({
          screenX: Math.min(e.clientX, window.innerWidth  - 230),
          screenY: e.clientY + 14,
          rects: lineRects,
          text,
        })
      })
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [pageNumber])

  // ── Save highlight to server ────────────────────────────────────────────────
  const saveHighlight = useCallback(async (color) => {
    if (!picker || saving) return
    setSaving(true)
    try {
      // Build a bounding box (x1/y1/x2/y2) from all rects for heatmap calculations
      const x1 = Math.min(...picker.rects.map(r => r.left))
      const y1 = Math.min(...picker.rects.map(r => r.top))
      const x2 = Math.max(...picker.rects.map(r => r.left + r.width))
      const y2 = Math.max(...picker.rects.map(r => r.top  + r.height))

      const { data } = await api.post('/api/highlights', {
        resource_id:  resourceId,
        page_number:  pageNumber,
        coordinates:  { rects: picker.rects, x1, y1, x2, y2 },
        text_content: picker.text,
        color,
      })

      onHighlightAdded?.(data.highlight)
      window.getSelection()?.removeAllRanges()
      setPicker(null)
    } catch (err) {
      console.error('[Highlight] save error:', err.message)
    } finally {
      setSaving(false)
    }
  }, [picker, saving, resourceId, pageNumber, onHighlightAdded])

  // ── Delete a highlight ──────────────────────────────────────────────────────
  const deleteHighlight = useCallback(async (id) => {
    try {
      await api.delete(`/api/highlights/${id}`)
      onHighlightDeleted?.(id)
    } catch (err) {
      console.error('[Highlight] delete error:', err.message)
    }
  }, [onHighlightDeleted])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        Highlight boxes — positioned with CSS % so they scale with zoom.
        The container is absolute inset-0 matching the overlay slot (which
        matches the react-pdf page via CSS). pointer-events:none on container
        so the text layer below can receive mouse events. Individual boxes get
        pointer-events:all so right-click delete works.
      */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {highlights.map((h) => {
          const coords = h.coordinates ?? {}
          // Support new format (rects array) and old format (x1/y1/x2/y2 bounding box)
          const rects = Array.isArray(coords.rects) && coords.rects.length > 0
            ? coords.rects
            : [{ left: coords.x1 ?? 0, top: coords.y1 ?? 0,
                 width: (coords.x2 ?? 0) - (coords.x1 ?? 0),
                 height: (coords.y2 ?? 0) - (coords.y1 ?? 0) }]

          return rects.map((r, i) => (
            <div
              key={`${h.id}-${i}`}
              title={`"${h.text_content || ''}" — right-click to delete`}
              onContextMenu={(e) => { e.preventDefault(); deleteHighlight(h.id) }}
              style={{
                position:        'absolute',
                left:            `${r.left   * 100}%`,
                top:             `${r.top    * 100}%`,
                width:           `${r.width  * 100}%`,
                height:          `${r.height * 100}%`,
                backgroundColor: h.color || '#facc15',
                opacity:         0.35,
                mixBlendMode:    'multiply',
                borderRadius:    2,
                pointerEvents:   'all',
                cursor:          'pointer',
              }}
            />
          ))
        })}
      </div>

      {/* Fixed color picker — always visible near cursor regardless of scroll */}
      {picker && (
        <div
          data-hl-picker
          style={{
            position:  'fixed',
            zIndex:    9999,
            left:      picker.screenX,
            top:       picker.screenY,
            display:   'flex',
            alignItems: 'center',
            gap:       6,
            padding:   '6px 10px',
            background: 'var(--background, #fff)',
            border:    '1px solid var(--border, #e5e7eb)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            pointerEvents: 'all',
          }}
        >
          <span style={{ fontSize: 11, color: '#888', fontWeight: 500, marginRight: 2 }}>
            Highlight
          </span>
          {COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              disabled={saving}
              onClick={() => saveHighlight(hex)}
              title={label}
              style={{
                width:           22,
                height:          22,
                borderRadius:    '50%',
                backgroundColor: hex,
                border:          '2px solid transparent',
                cursor:          'pointer',
                transition:      'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
          ))}
          <button
            onClick={() => { setPicker(null); window.getSelection()?.removeAllRanges() }}
            style={{ marginLeft: 4, color: '#aaa', fontSize: 16, cursor: 'pointer',
                     background: 'none', border: 'none', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
