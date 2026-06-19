import { useState, useEffect } from 'react'
import { Clock, Star, User, Tag, Zap, CheckCircle, AlertCircle, Eye, FileText, MessageSquare, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
  const { session } = useAuth()
  const [viewingFile, setViewingFile] = useState(false)

  const status = STATUS_CONFIG[bounty.status] || STATUS_CONFIG.open
  const isRequester = bounty.requester_id === currentUserId
  const isClaimer = bounty.claimer_id === currentUserId
  const isProfessor = currentUserRole === 'professor'
  const submissionCount = parseInt(bounty.submission_count || 0)

  // Who can do what
  const canClaim   = bounty.status === 'open' && !isRequester && !isProfessor
  const canSubmit  = bounty.status === 'claimed' && isClaimer
  // Requester or professor can review a pending submission
  const canReview  = submissionCount > 0 && (isRequester || isProfessor) && bounty.status === 'claimed' && bounty.latest_submission_status === 'pending'

  // Show submission info to the owner/professor so they know what was submitted
  // Works on ALL tabs since both getBounties and getMyBounties now return this data
  const hasSubmissionInfo = (isRequester || isProfessor) && submissionCount > 0 && bounty.latest_submitter_name

  const handleViewFile = async () => {
    if (!bounty.latest_resource_id) {
      alert('No file was attached to this submission.')
      return
    }
    setViewingFile(true)
    try {
      const token = session?.access_token || localStorage.getItem('nf_access_token')
      const res = await axios.get(`${API}/api/resources/${bounty.latest_resource_id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer')
      } else {
        alert('Could not retrieve the file URL.')
      }
    } catch (err) {
      console.error('[BountyCard] ❌ View file error:', err.response?.data?.error || err.message)
      alert(err.response?.data?.error || 'Failed to open the submitted file.')
    } finally {
      setViewingFile(false)
    }
  }

  return (
    <div className={cn(
      'group relative rounded-2xl border bg-card/60 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5',
      bounty.is_urgent && 'border-amber-500/40 shadow-amber-500/10',
      !bounty.is_urgent && 'border-border/50',
      canReview && 'ring-1 ring-amber-500/40'  // highlight cards needing review
    )}>
      {/* Urgent ribbon */}
      {bounty.is_urgent && !canReview && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
          <Zap className="w-3 h-3" /> URGENT
        </div>
      )}

      {/* Awaiting review badge */}
      {canReview && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
          <AlertCircle className="w-3 h-3" /> Review Needed
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
          <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors pr-16">
            {bounty.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{bounty.description}</p>

      {/* Submission preview — visible to bounty owner & professor when submission exists */}
      {hasSubmissionInfo && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/25 space-y-2">
          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Submission by {bounty.latest_submitter_name}
            <span className={cn(
              'ml-auto text-[10px] px-1.5 py-0.5 rounded-full border',
              bounty.latest_submission_status === 'pending'   && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              bounty.latest_submission_status === 'approved'  && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              bounty.latest_submission_status === 'rejected'  && 'bg-red-500/15 text-red-400 border-red-500/30',
            )}>
              {bounty.latest_submission_status || 'pending'}
            </span>
          </p>

          {bounty.latest_submission_note && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{bounty.latest_submission_note}</span>
            </p>
          )}

          {/* View submitted file */}
          {bounty.latest_resource_id ? (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs w-full gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={handleViewFile}
              disabled={viewingFile}
            >
              {viewingFile
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Opening…</>
                : <><ExternalLink className="w-3 h-3" /> View Submitted File</>
              }
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">No file attached to this submission</p>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{bounty.requester_name}</span>
        {bounty.claimer_name && bounty.status === 'claimed' && (
          <span className="text-amber-400 flex items-center gap-1">🏹 {bounty.claimer_name}</span>
        )}
        {bounty.expires_at && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            <Countdown expiresAt={bounty.expires_at} />
          </span>
        )}
        {submissionCount > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertCircle className="w-3 h-3" />{submissionCount} submission{submissionCount > 1 ? 's' : ''}
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
