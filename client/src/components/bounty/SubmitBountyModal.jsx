import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Upload, FileText, X } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function SubmitBountyModal({ open, onClose, bounty, onSubmitted }) {
  const { session } = useAuth()
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef()

  // Use localStorage fallback in case session hasn't hydrated yet
  const getHeaders = () => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    console.log('[SubmitBountyModal] Auth token present:', !!token)
    return { Authorization: `Bearer ${token}` }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    setError(''); setUploading(true)

    const headers = getHeaders()
    try {
      // 1. Upload the resource file first
      const fd = new FormData()
      fd.append('file', file)
      fd.append('syllabus_node_id', bounty.syllabus_node_id || '')
      fd.append('classroom_id', bounty.classroom_id)
      fd.append('description', note)

      console.log('[SubmitBountyModal] POST /api/resources/upload – file:', file.name, 'size:', file.size)
      const uploadRes = await axios.post(`${API}/api/resources/upload`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 100)),
      })
      console.log('[SubmitBountyModal] ✅ File uploaded – resourceId:', uploadRes.data.resourceId)

      // 2. Submit to bounty
      console.log(`[SubmitBountyModal] POST /api/bounties/${bounty.id}/submit – resourceId:`, uploadRes.data.resourceId)
      await axios.post(`${API}/api/bounties/${bounty.id}/submit`, {
        resource_id: uploadRes.data.resourceId,
        note,
      }, { headers })
      console.log('[SubmitBountyModal] ✅ Bounty submission created')

      onSubmitted?.()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || 'Submission failed'
      console.error('[SubmitBountyModal] ❌ Error:', err.response?.status, msg)
      setError(msg)
    } finally { setUploading(false); setProgress(0) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📤 Submit Resource for Bounty</DialogTitle>
        </DialogHeader>

        {bounty && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-2">
            <p className="text-sm font-medium">{bounty.title}</p>
            <p className="text-xs text-muted-foreground">Reward: {bounty.points_reward} pts</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx,.jpg,.png,.mp4"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }} className="ml-2 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload your resource</p>
                <p className="text-xs text-muted-foreground/60">PDF, DOCX, PPTX, Images, Videos</p>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {uploading && progress > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Uploading...</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="Any additional context about your submission..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={uploading || !file}>
              {uploading ? `Uploading ${progress}%...` : 'Submit Resource'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
