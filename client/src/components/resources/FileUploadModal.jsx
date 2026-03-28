import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, X, FileText, Image, Film, Presentation, File,
  CheckCircle, AlertCircle, Loader2, Plus, Tag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const DOC_TYPES = [
  { value: 'typed', label: 'Typed Notes' },
  { value: 'handwritten', label: 'Handwritten' },
  { value: 'ppt', label: 'Slides / PPT' },
  { value: 'image', label: 'Image / Scan' },
  { value: 'video', label: 'Video' },
  { value: 'other', label: 'Other' },
]

const ALLOWED_MIMES = [
  'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4',
]

const MAX_SIZES = {
  'application/pdf': 50, 'video/mp4': 100,
}
const DEFAULT_MAX_MB = 20

function getFileIcon(type) {
  if (!type) return File
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Film
  if (type.includes('presentation') || type.includes('ppt')) return Presentation
  return FileText
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Single file upload item ────────────────────────────────────────────────────
function FileUploadItem({ file, onRemove, nodeId, classroomId, onUploaded }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle') // idle|uploading|processing|done|error
  const [error, setError] = useState(null)
  const [docType, setDocType] = useState('other')
  const [year, setYear] = useState(new Date().getFullYear())
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [jobId, setJobId] = useState(null)
  const [resourceId, setResourceId] = useState(null)

  const maxMB = MAX_SIZES[file.type] || DEFAULT_MAX_MB
  const isTooBig = file.size > maxMB * 1024 * 1024
  const Icon = getFileIcon(file.type)

  const pollStatus = useCallback(async (rid, jid) => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/api/resources/${rid}/job-status?jobId=${jid}`)
        if (data.status === 'done' || data.dbStatus === 'done') {
          setStatus('done')
          onUploaded?.()
        } else if (data.status === 'failed' || data.dbStatus === 'failed') {
          setStatus('done') // still usable, just no thumbnail
        } else {
          setTimeout(() => poll(), 2000)
        }
      } catch { setStatus('done') }
    }
    poll()
  }, [onUploaded])

  const upload = async () => {
    if (isTooBig) return
    setStatus('uploading')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('syllabus_node_id', nodeId)
    formData.append('classroom_id', classroomId)
    formData.append('doc_type', docType)
    formData.append('year', year)
    formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)))
    formData.append('description', description)

    try {
      const token = localStorage.getItem('nf_access_token')
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/resources/upload')
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }

      const result = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
          else reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(formData)
      })

      setJobId(result.jobId)
      setResourceId(result.resourceId)
      setStatus('processing')
      pollStatus(result.resourceId, result.jobId)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      status === 'done' ? 'border-emerald-500/30 bg-emerald-500/5' :
      status === 'error' ? 'border-destructive/30 bg-destructive/5' :
      'border-border/50 bg-card/50'
    )}>
      {/* File info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className={cn('text-xs', isTooBig ? 'text-destructive' : 'text-muted-foreground')}>
            {formatSize(file.size)} {isTooBig && `(max ${maxMB}MB)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'done' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
          {(status === 'uploading' || status === 'processing') && (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          )}
          {status === 'idle' && (
            <button onClick={() => onRemove(file)} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata form (only shown when idle) */}
      {status === 'idle' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full text-sm bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-foreground"
            >
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-8 text-sm"
              min={2000} max={2100}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
            <Input
              placeholder="e.g. exam, mid-sem, unit-1"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <textarea
              placeholder="Brief description of this file…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Upload progress */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{status === 'uploading' ? 'Uploading…' : 'Processing… (generating thumbnail)'}</span>
            {status === 'uploading' && <span>{progress}%</span>}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-300',
                status === 'processing' ? 'bg-amber-400 animate-pulse w-full' : 'bg-primary')}
              style={status === 'uploading' ? { width: `${progress}%` } : {}}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {status === 'done' && (
        <p className="text-xs text-emerald-400">✓ Uploaded successfully</p>
      )}

      {status === 'idle' && !isTooBig && (
        <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={upload}>
          <Upload className="w-3.5 h-3.5" /> Upload File
        </Button>
      )}
    </div>
  )
}

// ── Main Upload Modal ─────────────────────────────────────────────────────────
export default function FileUploadModal({ open, onClose, nodeId, nodeTitle, classroomId, onUploaded }) {
  const [files, setFiles] = useState([])

  const onDrop = useCallback((accepted, rejected) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size)),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_MIMES.reduce((acc, m) => ({ ...acc, [m]: [] }), {}),
    maxFiles: 5,
    multiple: true,
  })

  const removeFile = (file) => setFiles((prev) => prev.filter((f) => f !== file))

  const handleClose = () => {
    setFiles([])
    onClose()
    onUploaded?.()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Upload Files
            {nodeTitle && <span className="text-sm text-muted-foreground font-normal">→ {nodeTitle}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-accent/20'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">{isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}</p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF (50MB), DOCX, PPTX (20MB), Images (10MB), Video (100MB)
          </p>
          <p className="text-xs text-muted-foreground mt-1">Up to 5 files at once</p>
        </div>

        {/* File items */}
        {files.length > 0 && (
          <div className="space-y-3 mt-2">
            {files.map((file, i) => (
              <FileUploadItem
                key={`${file.name}-${i}`}
                file={file}
                onRemove={removeFile}
                nodeId={nodeId}
                classroomId={classroomId}
                onUploaded={onUploaded}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
