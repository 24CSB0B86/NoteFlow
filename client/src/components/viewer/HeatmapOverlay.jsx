import { useEffect, useRef, useCallback } from 'react'

// ── Color scale: blue → yellow → red ────────────────────────────────────────
function intensityToColor(intensity) {
  // intensity: 0-100
  const t = intensity / 100
  let r, g, b
  if (t < 0.5) {
    // blue → cyan → yellow
    const u = t * 2
    r = Math.round(u * 255)
    g = Math.round(u * 255)
    b = Math.round((1 - u) * 255)
  } else {
    // yellow → red
    const u = (t - 0.5) * 2
    r = 255
    g = Math.round((1 - u) * 255)
    b = 0
  }
  return `rgba(${r},${g},${b},${Math.min(0.7, 0.15 + (intensity / 100) * 0.55)})`
}

export default function HeatmapOverlay({ zones, pageWidth, pageHeight, visible, highlightCount }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, pageWidth, pageHeight)

    if (!visible || !zones?.length) return

    for (const zone of zones) {
      const x = zone.x * pageWidth
      const y = zone.y * pageHeight
      const w = zone.width * pageWidth
      const h = zone.height * pageHeight
      ctx.fillStyle = intensityToColor(zone.intensity)
      ctx.fillRect(x, y, w, h)
    }
  }, [zones, pageWidth, pageHeight, visible])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={pageWidth}
      height={pageHeight}
      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      title={highlightCount ? `${highlightCount} highlight${highlightCount !== 1 ? 's' : ''} on this page` : ''}
    />
  )
}
