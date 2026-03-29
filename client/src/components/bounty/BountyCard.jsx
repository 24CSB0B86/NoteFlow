import { useState, useEffect } from 'react'
import { Clock, Star, User, Tag, Zap, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function Countdown({ expiresAt }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    calc()
    const t = setInterval(calc, 60000)
    return () => clearInterval(t)
  }, [expiresAt])

  return <span>{remaining}</span>
}

const STATUS_CONFIG = {
  open:      { label: 'Open',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  claimed:   { label: 'Claimed',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  fulfilled: { label: 'Fulfilled', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  closed:    { label: 'Closed',    color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  expired:   { label: 'Expired',   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export default function BountyCard({ bounty, currentUserId, currentUserRole, onClaim, onSubmit, onApprove, onReject, onCancel, onView }) {
  const status = STATUS_CONFIG[bounty.status] || STATUS_CONFIG.open
  const isRequester = bounty.requester_id === currentUserId
  const isClaimer = bounty.claimer_id === currentUserId
  const isProfessor = currentUserRole === 'professor'
  const canClaim = bounty.status === 'open' && !isRequester && currentUserRole === 'student'
  const canSubmit = bounty.status === 'claimed' && isClaimer
  const canReview = bounty.submission_count > 0 && (isRequester || isProfessor) && bounty.status === 'claimed'

  return (
    <div className={cn(
      'group relative rounded-2xl border bg-card/60 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5',
      bounty.is_urgent && 'border-amber-500/40 shadow-amber-500/10',
      !bounty.is_urgent && 'border-border/50'
    )}>
      {/* Urgent ribbon */}
      {bounty.is_urgent && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
          <Zap className="w-3 h-3" /> URGENT
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Points badge */}
        <div className={cn(
          'flex flex-col items-center justify-center min-w-[56px] h-14 rounded-xl border font-bold',
          bounty.is_urgent
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            : 'bg-primary/15 border-primary/30 text-primary'
        )}>
          <Star className="w-3.5 h-3.5 mb-0.5" />
          <span className="text-lg leading-none">{bounty.points_reward}</span>
          <span className="text-[9px] opacity-70">pts</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
            {bounty.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', status.color)}>{status.label}</span>
            {bounty.node_title && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="w-3 h-3" />{bounty.node_title}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{bounty.description}</p>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{bounty.requester_name}</span>
        {bounty.expires_at && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            <Countdown expiresAt={bounty.expires_at} />
          </span>
        )}
        {bounty.submission_count > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertCircle className="w-3 h-3" />{bounty.submission_count} submission{bounty.submission_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {onView && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onView(bounty)}>
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
        )}
        {canClaim && (
          <Button size="sm" className="h-7 text-xs" onClick={() => onClaim(bounty.id)}>
            🏹 Claim Bounty
          </Button>
        )}
        {canSubmit && (
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onSubmit(bounty)}>
            📤 Submit Resource
          </Button>
        )}
        {canReview && (
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(bounty.id)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => onReject(bounty.id)}>
              Reject
            </Button>
          </div>
        )}
        {isRequester && ['open', 'claimed'].includes(bounty.status) && onCancel && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto" onClick={() => onCancel(bounty.id)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
