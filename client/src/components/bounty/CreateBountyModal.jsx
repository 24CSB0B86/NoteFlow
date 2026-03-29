import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Zap, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CreateBountyModal({ open, onClose, onSubmit, syllabusNodes = [], classroomId }) {
  const [form, setForm] = useState({
    title: '', description: '', points_reward: 10,
    syllabus_node_id: '', is_urgent: false, expires_in_days: 7
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finalPoints = form.is_urgent ? form.points_reward * 2 : form.points_reward

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required'); return
    }
    setError(''); setLoading(true)
    try {
      await onSubmit({ ...form, classroom_id: classroomId, points_reward: finalPoints })
      setForm({ title: '', description: '', points_reward: 10, syllabus_node_id: '', is_urgent: false, expires_in_days: 7 })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bounty')
    } finally { setLoading(false) }
  }

  // Flatten syllabus tree for dropdown
  const flatNodes = syllabusNodes.filter(n => n.node_type !== 'unit')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🏹 Post a Bounty
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Need detailed notes on Binary Trees"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe what kind of resource you're looking for..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              required
            />
          </div>

          {/* Syllabus Topic */}
          {flatNodes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Topic (optional)</Label>
              <Select
                value={form.syllabus_node_id || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, syllabus_node_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific topic</SelectItem>
                  {flatNodes.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.node_type === 'subtopic' ? '  └ ' : ''}{n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}


          {/* Points & Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Star className="w-3 h-3" /> Base Points</Label>
              <Input
                type="number" min={5} max={100}
                value={form.points_reward}
                onChange={e => setForm(f => ({ ...f, points_reward: parseInt(e.target.value) || 10 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expires in (days)</Label>
              <Input
                type="number" min={1} max={30}
                value={form.expires_in_days}
                onChange={e => setForm(f => ({ ...f, expires_in_days: parseInt(e.target.value) || 7 }))}
              />
            </div>
          </div>

          {/* Urgent toggle */}
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_urgent: !f.is_urgent }))}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
              form.is_urgent
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                : 'border-border/50 hover:border-border text-muted-foreground'
            )}
          >
            <Zap className={cn('w-5 h-5 shrink-0', form.is_urgent && 'fill-amber-400')} />
            <div>
              <div className="font-medium text-sm">Mark as Urgent</div>
              <div className="text-xs opacity-70">Doubles points reward — highlighted in the board</div>
            </div>
            <div className="ml-auto font-bold text-lg">
              {finalPoints} <span className="text-xs font-normal">pts</span>
            </div>
          </button>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : `Post for ${finalPoints} pts`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
