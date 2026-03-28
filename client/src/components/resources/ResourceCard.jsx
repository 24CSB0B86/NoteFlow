import { useState } from 'react'
import { FileText, Image, Film, Presentation, File, Download, Eye,
  CheckCircle, AlertCircle, Loader2, Clock, BadgeCheck, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

function getFileIcon(type) {
  if (!type) return File
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Film
  if (type.includes('presentation') || type.includes('ppt')) return Presentation
  return FileText
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const TYPE_BADGE_COLORS = {
  typed: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  handwritten: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  ppt: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  image: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  video: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  other: 'bg-muted text-muted-foreground',
}

export default function ResourceCard({ resource, onView, onVersionHistory }) {
  const [downloading, setDownloading] = useState(false)
  const Icon = getFileIcon(resource.file_type)
  const isProcessing = resource.processing_status === 'processing' || resource.processing_status === 'pending'

  const handleDownload = async (e) => {
    e.stopPropagation()
    setDownloading(true)
    try {
      const { data } = await api.get(`/api/resources/${resource.id}/download`)
      // Open signed URL in new tab
      const a = document.createElement('a')
      a.href = data.url
      a.download = data.fileName
      a.target = '_blank'
      a.click()
    } catch (err) {
      console.error('Download failed:', err.message)
    } finally { setDownloading(false) }
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-primary/30',
        'hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer overflow-hidden',
      )}
      onClick={() => !isProcessing && resource.file_type?.includes('pdf') && onView?.(resource)}
    >
      {/* Thumbnail area */}
      <div className="relative h-40 bg-gradient-to-br from-muted/50 to-muted/20 overflow-hidden">
        {resource.thumbnailUrl ? (
          <img
            src={resource.thumbnailUrl}
            alt={resource.file_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Processing…</span>
              </div>
            ) : (
              <Icon className="w-12 h-12 text-muted-foreground/40" />
            )}
          </div>
        )}

        {/* Overlays */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="bg-black/60 backdrop-blur text-white text-xs font-mono px-2 py-0.5 rounded-full">
            v{resource.version}
          </span>
          {resource.is_verified && (
            <span className="bg-emerald-500/80 backdrop-blur text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Verified
            </span>
          )}
        </div>

        {/* View overlay (PDF only) */}
        {resource.file_type?.includes('pdf') && !isProcessing && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <div className="bg-white/10 backdrop-blur rounded-full p-3 text-white">
              <Eye className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="text-sm font-medium truncate" title={resource.file_name}>
            {resource.file_name}
          </h3>
          {resource.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{resource.description}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 flex-wrap">
          {resource.doc_type && resource.doc_type !== 'other' && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full border capitalize', TYPE_BADGE_COLORS[resource.doc_type] || TYPE_BADGE_COLORS.other)}>
              {resource.doc_type}
            </span>
          )}
          {resource.year && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {resource.year}
            </span>
          )}
          {resource.page_count && (
            <span className="text-xs text-muted-foreground">{resource.page_count}p</span>
          )}
        </div>

        {/* Tags */}
        {resource.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {resource.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[9px]">
              {resource.uploader_name?.[0]?.toUpperCase()}
            </div>
            <span className="truncate max-w-[80px]">{resource.uploader_name}</span>
            <span>·</span>
            <span>{timeAgo(resource.created_at)}</span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {resource.version > 1 && (
              <button
                onClick={() => onVersionHistory?.(resource)}
                className="text-xs text-primary/70 hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
              >
                History
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Download"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
