import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, ThumbsUp, ThumbsDown, Reply, MoreHorizontal, Pin,
  CheckCircle, Plus, X, Send, ChevronDown, ChevronUp, Loader2, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

// ── Relative time helper ──────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 7 }) {
  const initials = name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?'
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const color = colors[name?.charCodeAt(0) % colors.length] || colors[0]
  return (
    <div className={cn(`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0`, color)}>
      {initials}
    </div>
  )
}

// ── Inline reply/new-discussion form ─────────────────────────────────────────
function DiscussionForm({ placeholder = 'Write a comment…', onSubmit, onCancel, loading }) {
  const [content, setContent] = useState('')
  const textRef = useRef(null)

  useEffect(() => { textRef.current?.focus() }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit(content.trim())
    setContent('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-end">
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="flex-1 text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
      />
      <div className="flex flex-col gap-1">
        <Button type="submit" size="icon" className="h-8 w-8" disabled={loading || !content.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        </Button>
        {onCancel && (
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </form>
  )
}

// ── Single Discussion Thread Item ─────────────────────────────────────────────
function DiscussionItem({ discussion, resourceId, onUpdated, depth = 0 }) {
  const { user } = useAuth()
  const [showReplies, setShowReplies] = useState(true)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(discussion.content)
  const [submitting, setSubmitting] = useState(false)
  const [optimisticVote, setOptimisticVote] = useState(discussion.user_vote)
  const [optimisticUpvotes, setOptimisticUpvotes] = useState(discussion.upvotes)
  const [optimisticDownvotes, setOptimisticDownvotes] = useState(discussion.downvotes)

  const isOwn = user?.id === discussion.user_id
  const isProfessor = user?.role === 'professor'

  const vote = async (voteType) => {
    const newVote = optimisticVote === voteType ? null : voteType
    // Optimistic update
    const prevUp = optimisticUpvotes
    const prevDown = optimisticDownvotes
    const prevVote = optimisticVote

    if (newVote === 'up') {
      setOptimisticUpvotes(v => v + 1)
      if (prevVote === 'down') setOptimisticDownvotes(v => v - 1)
    } else if (newVote === 'down') {
      setOptimisticDownvotes(v => v + 1)
      if (prevVote === 'up') setOptimisticUpvotes(v => v - 1)
    } else {
      if (prevVote === 'up') setOptimisticUpvotes(v => v - 1)
      if (prevVote === 'down') setOptimisticDownvotes(v => v - 1)
    }
    setOptimisticVote(newVote)

    try {
      const { data } = await api.post(`/api/discussions/${discussion.id}/vote`, { vote_type: newVote })
      setOptimisticUpvotes(data.upvotes)
      setOptimisticDownvotes(data.downvotes)
      setOptimisticVote(data.user_vote)
    } catch {
      setOptimisticUpvotes(prevUp)
      setOptimisticDownvotes(prevDown)
      setOptimisticVote(prevVote)
    }
  }

  const handleReply = async (content) => {
    setSubmitting(true)
    try {
      await api.post('/api/discussions', {
        resource_id: resourceId,
        parent_id: discussion.id,
        content,
        page_number: discussion.page_number,
      })
      setShowReplyForm(false)
      onUpdated?.()
    } catch (err) {
      console.error(err)
    } finally { setSubmitting(false) }
  }

  const handleEdit = async () => {
    setSubmitting(true)
    try {
      await api.put(`/api/discussions/${discussion.id}`, { content: editContent })
      setEditing(false)
      onUpdated?.()
    } catch (err) {
      console.error(err)
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return
    try {
      await api.delete(`/api/discussions/${discussion.id}`)
      onUpdated?.()
    } catch (err) { console.error(err) }
  }

  const handleResolve = async () => {
    try {
      await api.post(`/api/discussions/${discussion.id}/resolve`)
      onUpdated?.()
    } catch (err) { console.error(err) }
  }

  const handlePin = async () => {
    try {
      await api.post(`/api/discussions/${discussion.id}/pin`)
      onUpdated?.()
    } catch (err) { console.error(err) }
  }

  return (
    <div className={cn('group', depth > 0 && 'ml-8 mt-2')}>
      <div className={cn(
        'rounded-xl p-3 border transition-colors',
        discussion.pinned ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/50 hover:border-border/70'
      )}>
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          <Avatar name={discussion.full_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{discussion.full_name}</span>
              {discussion.page_number && (
                <span className="text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                  p.{discussion.page_number}
                </span>
              )}
              {discussion.pinned && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Pin className="w-3 h-3" /> Pinned
                </span>
              )}
              {discussion.resolved && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Resolved
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(discussion.created_at)}</span>
          </div>
          {/* Actions dropdown */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {(isOwn || isProfessor) && (
              <>
                {isOwn && !editing && (
                  <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted">
                    Edit
                  </button>
                )}
                <button onClick={handleDelete} className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10">
                  Delete
                </button>
              </>
            )}
            {depth === 0 && (isOwn || isProfessor) && (
              <button onClick={handleResolve} className="text-xs text-muted-foreground hover:text-emerald-400 px-1.5 py-0.5 rounded hover:bg-emerald-400/10">
                {discussion.resolved ? 'Unresolve' : 'Resolve'}
              </button>
            )}
            {depth === 0 && isProfessor && (
              <button onClick={handlePin} className="text-xs text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10">
                {discussion.pinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit} disabled={submitting} className="h-7">
                {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7">Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{discussion.content}</p>
        )}

        {/* Footer: votes + reply */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
          <button
            onClick={() => vote('up')}
            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors',
              optimisticVote === 'up' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/10')}
          >
            <ThumbsUp className="w-3 h-3" /> {optimisticUpvotes}
          </button>
          <button
            onClick={() => vote('down')}
            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors',
              optimisticVote === 'down' ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10')}
          >
            <ThumbsDown className="w-3 h-3" /> {optimisticDownvotes}
          </button>
          {depth === 0 && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-auto"
            >
              <Reply className="w-3 h-3" /> Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-2">
            <DiscussionForm
              placeholder="Write a reply… (Ctrl+Enter to send)"
              onSubmit={handleReply}
              onCancel={() => setShowReplyForm(false)}
              loading={submitting}
            />
          </div>
        )}
      </div>

      {/* Nested replies */}
      {discussion.replies?.length > 0 && (
        <div className="mt-1">
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-10 mb-1"
          >
            {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {discussion.replies.length} {discussion.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && discussion.replies.map((reply) => (
            <DiscussionItem
              key={reply.id}
              discussion={reply}
              resourceId={resourceId}
              onUpdated={onUpdated}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Discussion Sidebar ────────────────────────────────────────────────────────
export default function DiscussionSidebar({ resourceId, currentPage, visible, onClose }) {
  const { user } = useAuth()
  const [discussions, setDiscussions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterPage, setFilterPage] = useState(false)
  const [sort, setSort] = useState('newest')
  const pollingRef = useRef(null)

  const fetchDiscussions = useCallback(async () => {
    if (!resourceId) return
    try {
      const params = new URLSearchParams({ sort })
      if (filterPage && currentPage) params.set('page', currentPage)
      const { data } = await api.get(`/api/discussions/${resourceId}?${params}`)
      setDiscussions(data.discussions || [])
    } catch (err) {
      console.error('Failed to fetch discussions:', err.message)
    }
  }, [resourceId, sort, filterPage, currentPage])

  // Initial load + polling every 15s
  useEffect(() => {
    if (!visible) return
    setLoading(true)
    fetchDiscussions().finally(() => setLoading(false))
    pollingRef.current = setInterval(fetchDiscussions, 15000)
    return () => clearInterval(pollingRef.current)
  }, [visible, fetchDiscussions])

  const handleNewDiscussion = async (content) => {
    setSubmitting(true)
    try {
      await api.post('/api/discussions', {
        resource_id: resourceId,
        content,
        page_number: currentPage || null,
      })
      setShowNewForm(false)
      fetchDiscussions()
    } catch (err) {
      console.error(err)
    } finally { setSubmitting(false) }
  }

  return (
    <div className={cn(
      'flex flex-col h-full border-l border-border bg-card/80 backdrop-blur transition-all duration-300',
      visible ? 'w-80' : 'w-0 overflow-hidden'
    )}>
      {visible && (
        <>
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Discussions</h3>
              {discussions.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">{discussions.length}</span>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0 flex-wrap">
            <button
              onClick={() => setFilterPage((v) => !v)}
              className={cn(
                'text-xs px-2 py-1 rounded-full border transition-colors',
                filterPage ? 'bg-primary/20 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              {filterPage ? `Page ${currentPage}` : 'All pages'}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs bg-transparent border border-border rounded px-1.5 py-0.5 text-muted-foreground ml-auto"
            >
              <option value="newest">Newest</option>
              <option value="votes">Most voted</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>

          {/* New discussion button */}
          <div className="px-3 py-2 shrink-0">
            {!showNewForm ? (
              <Button
                size="sm"
                className="w-full h-8 gap-1.5 text-xs"
                onClick={() => setShowNewForm(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                New Discussion {currentPage && `(p.${currentPage})`}
              </Button>
            ) : (
              <DiscussionForm
                placeholder="Start a discussion…"
                onSubmit={handleNewDiscussion}
                onCancel={() => setShowNewForm(false)}
                loading={submitting}
              />
            )}
          </div>

          {/* Discussion list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No discussions yet</p>
                <p className="text-xs text-muted-foreground/60">Be the first to start one!</p>
              </div>
            ) : (
              discussions.map((d) => (
                <DiscussionItem
                  key={d.id}
                  discussion={d}
                  resourceId={resourceId}
                  onUpdated={fetchDiscussions}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
