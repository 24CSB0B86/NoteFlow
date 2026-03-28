import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const COLORS = ['#facc15', '#f87171', '#4ade80', '#60a5fa', '#c084fc', '#fb923c']

// Convert selection rects to normalized coords relative to the page element
function getRelativeCoords(selection, pageEl) {
  if (!pageEl || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  const rects = range.getClientRects()
  if (!rects.length) return null

  const pageRect = pageEl.getBoundingClientRect()
  const r = rects[0]
  const x1 = (r.left - pageRect.left) / pageRect.width
  const y1 = (r.top - pageRect.top) / pageRect.height
  const x2 = (r.right - pageRect.left) / pageRect.width
  const y2 = (r.bottom - pageRect.top) / pageRect.height

  const textContent = selection.toString().trim()
  return {
    coords: {
      x1: Math.max(0, Math.min(1, x1)),
      y1: Math.max(0, Math.min(1, y1)),
      x2: Math.max(0, Math.min(1, x2)),
      y2: Math.max(0, Math.min(1, y2)),
    },
    textContent,
  }
}

export default function HighlightLayer({
  resourceId, pageNumber, pageWidth, pageHeight,
  highlights, onHighlightAdded, onHighlightDeleted,
}) {
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 })
  const [pendingSelection, setPendingSelection] = useState(null)
  const [saving, setSaving] = useState(false)
  const layerRef = useRef(null)

  const handleMouseUp = useCallback((e) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setShowColorPicker(false)
      return
    }

    const pageEl = layerRef.current?.closest('.react-pdf__Page')
    if (!pageEl) return

    const info = getRelativeCoords(selection, pageEl)
    if (!info || !info.textContent) {
      setShowColorPicker(false)
      return
    }

    // Show color picker near cursor
    const layerRect = layerRef.current.getBoundingClientRect()
    setPickerPos({
      x: Math.min(e.clientX - layerRect.left, pageWidth - 180),
      y: Math.max(0, e.clientY - layerRect.top - 10),
    })
    setPendingSelection(info)
    setShowColorPicker(true)
  }, [pageWidth])

  const saveHighlight = useCallback(async (color) => {
    if (!pendingSelection || saving) return
    setSaving(true)
    setShowColorPicker(false)
    try {
      const { data } = await api.post('/api/highlights', {
        resource_id: resourceId,
        page_number: pageNumber,
        coordinates: pendingSelection.coords,
        text_content: pendingSelection.textContent,
        color,
      })
      onHighlightAdded?.(data.highlight)
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      console.error('Failed to save highlight:', err.message)
    } finally {
      setSaving(false)
      setPendingSelection(null)
    }
  }, [pendingSelection, saving, resourceId, pageNumber, onHighlightAdded])

  const handleDeleteHighlight = useCallback(async (highlightId) => {
    try {
      await api.delete(`/api/highlights/${highlightId}`)
      onHighlightDeleted?.(highlightId)
    } catch (err) {
      console.error('Failed to delete highlight:', err.message)
    }
  }, [onHighlightDeleted])

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 select-text"
      style={{ width: pageWidth, height: pageHeight }}
      onMouseUp={handleMouseUp}
      onClick={() => { if (!pendingSelection) setShowColorPicker(false) }}
    >
      {/* Saved highlights */}
      {highlights.map((h) => {
        const x = h.coordinates.x1 * pageWidth
        const y = h.coordinates.y1 * pageHeight
        const w = (h.coordinates.x2 - h.coordinates.x1) * pageWidth
        const ht = (h.coordinates.y2 - h.coordinates.y1) * pageHeight
        return (
          <div
            key={h.id}
            className="absolute rounded-sm cursor-pointer group transition-opacity hover:opacity-100"
            style={{
              left: x, top: y, width: Math.max(w, 20), height: Math.max(ht, 8),
              backgroundColor: h.color || '#facc15',
              opacity: 0.35,
              pointerEvents: 'all',
            }}
            title={h.text_content || 'Your highlight'}
            onContextMenu={(e) => {
              e.preventDefault()
              handleDeleteHighlight(h.id)
            }}
          />
        )
      })}

      {/* Color picker popup */}
      {showColorPicker && (
        <div
          className="absolute z-50 bg-card border border-border rounded-xl shadow-2xl p-3 flex items-center gap-2"
          style={{ left: pickerPos.x, top: pickerPos.y, pointerEvents: 'all' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground mr-1">Highlight</span>
          {COLORS.map((c) => (
            <button
              key={c}
              disabled={saving}
              onClick={() => saveHighlight(c)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform hover:scale-125',
                selectedColor === c ? 'border-foreground' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
