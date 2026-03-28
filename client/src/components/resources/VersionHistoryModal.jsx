import { useState, useEffect } from 'react'
import { History, Download, RotateCcw, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short'
  })
}

export default function VersionHistoryModal({ open, onClose, resource, onRollback }) {
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [rollingBack, setRollingBack] = useState(null)

  const isProfessor = user?.role === 'professor'

  useEffect(() => {
    if (!open || !resource?.id) return
    setLoading(true)
    api.get(`/api/resources/${resource.id}/versions`)
      .then(({ data }) => setVersions(data.versions || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [open, resource?.id])

  const handleDownloadVersion = async (version) => {
    try {
      // Use the file_path for a signed URL
      const signedRes = await api.get(`/api/resources/${resource.id}/download`)
      window.open(signedRes.data.url, '_blank')
    } catch (err) { console.error(err) }
  }

  const handleRollback = async (version) => {
    if (!confirm(`Roll back "${resource.file_name}" to v${version.version_number}?`)) return
    setRollingBack(version.id)
    try {
      await api.post(`/api/resources/${resource.id}/rollback/${version.id}`)
      onRollback?.()
      onClose()
    } catch (err) {
      console.error(err)
    } finally { setRollingBack(null) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Version History
            <span className="text-sm font-normal text-muted-foreground truncate">— {resource?.file_name}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versions.map((v, idx) => (
              <div
                key={v.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  v.is_current
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/40 bg-card/50'
                )}
              >
                {/* Timeline dot */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  v.is_current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  v{v.version_number}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {v.is_current && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <CheckCircle className="w-3 h-3" /> Current
                      </span>
                    )}
                    {v.uploader_name && (
                      <span className="text-xs text-muted-foreground">{v.uploader_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(v.uploaded_at)}
                    </span>
                    {v.file_size && <span>{formatSize(v.file_size)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadVersion(v)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Download this version"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {isProfessor && !v.is_current && (
                    <button
                      onClick={() => handleRollback(v)}
                      disabled={!!rollingBack}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                      title="Rollback to this version"
                    >
                      {rollingBack === v.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
