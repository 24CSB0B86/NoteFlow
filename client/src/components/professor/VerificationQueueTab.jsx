import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2, FileText, User, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function RejectDialog({ open, onClose, onReject }) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reject Resource</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason for rejection</Label>
            <Textarea placeholder="e.g. Missing key concepts, incorrect information..." value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => { onReject(reason); setReason('') }}>Reject</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function VerificationQueueTab({ data, loading, onVerify, onReject }) {
  const [selected, setSelected] = useState([])
  const [rejectTarget, setRejectTarget] = useState(null)
  const queue = data?.queue || []

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const allSelected = queue.length > 0 && selected.length === queue.length

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1" onClick={() => { onVerify(selected); setSelected([]) }}>
            <CheckCircle className="w-3 h-3" /> Approve All
          </Button>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <CheckCircle className="w-16 h-16 opacity-20" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm">No resources pending verification.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queue.map(item => (
            <Card key={item.id} className={cn('glass border-border/50 hover:border-primary/30 transition-all', selected.includes(item.resource_id) && 'border-primary/40 bg-primary/5')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.resource_id)}
                    onChange={() => toggleSelect(item.resource_id)}
                    className="mt-1 rounded"
                  />
                  {/* File icon / thumbnail */}
                  <div className="w-12 h-14 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.file_name}</p>
                    <p className="text-xs text-muted-foreground">{item.node_title || 'No topic'}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{item.uploader_name}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pl-[52px]">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                    onClick={() => onVerify([item.resource_id])}
                  >
                    <CheckCircle className="w-3 h-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1 text-red-400 border-red-400/30 hover:bg-red-500/10 gap-1"
                    onClick={() => setRejectTarget(item.resource_id)}
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={(reason) => { onReject(rejectTarget, reason); setRejectTarget(null) }}
      />
    </div>
  )
}
