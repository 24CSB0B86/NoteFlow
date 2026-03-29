import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSyllabus } from '@/context/SyllabusContext'
import Layout from '@/components/Layout'
import BountyCard from '@/components/bounty/BountyCard'
import CreateBountyModal from '@/components/bounty/CreateBountyModal'
import SubmitBountyModal from '@/components/bounty/SubmitBountyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Search, Trophy, ArrowLeft, Loader2, SlidersHorizontal, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function RejectModal({ open, onClose, onReject }) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reject Submission</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea placeholder="Why is this being rejected?" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={() => onReject(reason)} className="flex-1">Reject</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const TABS = [
  { id: 'all', label: 'All Bounties', icon: Trophy },
  { id: 'my-requests', label: 'My Requests', icon: Star },
  { id: 'my-claims', label: 'My Claims', icon: '🏹' },
]

export default function BountyBoardPage() {
  const { classroomId } = useParams()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { nodes, fetchSyllabus } = useSyllabus()

  const [tab, setTab] = useState('all')
  const [bounties, setBounties] = useState([])
  const [myBounties, setMyBounties] = useState({ created: [], claimed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showCreate, setShowCreate] = useState(false)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  // Build auth headers from session
  const getHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    console.log('[BountyBoard] Building auth headers – token present:', !!token)
    return { Authorization: `Bearer ${token}` }
  }, [session])

  const load = useCallback(async () => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    if (!token) {
      console.warn('[BountyBoard] No auth token available – skipping load')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const headers = { Authorization: `Bearer ${token}` }

    try {
      const params = new URLSearchParams()
      // 'all' is a UI sentinel – don't send it to the API (no filter means show all)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('sortBy', sortBy)

      console.log(`[BountyBoard] GET /api/bounties/${classroomId}?${params}`)
      console.log('[BountyBoard] GET /api/bounties/my-bounties')

      const [allRes, myRes] = await Promise.all([
        axios.get(`${API}/api/bounties/${classroomId}?${params}`, { headers }),
        axios.get(`${API}/api/bounties/my-bounties`, { headers }),
      ])

      console.log('[BountyBoard] ✅ Got', allRes.data.bounties?.length, 'bounties')
      console.log('[BountyBoard] ✅ My bounties – created:', myRes.data.created?.length, 'claimed:', myRes.data.claimed?.length)

      setBounties(allRes.data.bounties || [])
      setMyBounties({ created: myRes.data.created || [], claimed: myRes.data.claimed || [] })
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      console.error('[BountyBoard] ❌ Load failed:', err.response?.status, msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [classroomId, statusFilter, search, sortBy, session])

  // Load bounties whenever filter/session changes
  useEffect(() => {
    console.log('[BountyBoard] useEffect triggered – classroomId:', classroomId, 'session present:', !!session)
    load()
  }, [load])

  // Load syllabus tree for node selector in CreateBounty
  useEffect(() => {
    if (classroomId) {
      console.log('[BountyBoard] Fetching syllabus for classroomId:', classroomId)
      fetchSyllabus(classroomId)
    }
  }, [classroomId, fetchSyllabus])

  const handleClaim = async (id) => {
    const headers = getHeaders()
    console.log(`[BountyBoard] POST /api/bounties/${id}/claim`)
    try {
      await axios.post(`${API}/api/bounties/${id}/claim`, {}, { headers })
      console.log(`[BountyBoard] ✅ Claimed bounty ${id}`)
      load()
    } catch (err) {
      console.error('[BountyBoard] ❌ Claim failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Failed to claim bounty')
    }
  }

  const handleApprove = async (id) => {
    const headers = getHeaders()
    console.log(`[BountyBoard] POST /api/bounties/${id}/approve`)
    try {
      await axios.post(`${API}/api/bounties/${id}/approve`, {}, { headers })
      console.log(`[BountyBoard] ✅ Approved bounty ${id}`)
      load()
    } catch (err) {
      console.error('[BountyBoard] ❌ Approve failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Failed to approve bounty')
    }
  }

  const handleReject = async (id, reason) => {
    const headers = getHeaders()
    console.log(`[BountyBoard] POST /api/bounties/${id}/reject – reason:`, reason)
    try {
      await axios.post(`${API}/api/bounties/${id}/reject`, { reason }, { headers })
      console.log(`[BountyBoard] ✅ Rejected bounty submission ${id}`)
      setRejectTarget(null)
      load()
    } catch (err) {
      console.error('[BountyBoard] ❌ Reject failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Failed to reject bounty')
    }
  }

  const handleCancel = async (id) => {
    if (!confirm('Cancel this bounty?')) return
    const headers = getHeaders()
    console.log(`[BountyBoard] DELETE /api/bounties/${id}`)
    try {
      await axios.delete(`${API}/api/bounties/${id}`, { headers })
      console.log(`[BountyBoard] ✅ Cancelled bounty ${id}`)
      load()
    } catch (err) {
      console.error('[BountyBoard] ❌ Cancel failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Failed to cancel bounty')
    }
  }

  const handleCreate = async (form) => {
    const headers = getHeaders()
    console.log('[BountyBoard] POST /api/bounties – form:', form)
    try {
      const res = await axios.post(`${API}/api/bounties`, form, { headers })
      console.log('[BountyBoard] ✅ Created bounty:', res.data.bounty?.id)
      setShowCreate(false)
      load()
    } catch (err) {
      console.error('[BountyBoard] ❌ Create failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Failed to create bounty')
    }
  }

  const displayBounties = tab === 'all' ? bounties
    : tab === 'my-requests' ? myBounties.created
    : myBounties.claimed

  const flatNodes = nodes.filter(n => n.node_type !== 'unit')

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/classrooms/${classroomId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🏹 Bounty Board</h1>
            <p className="text-sm text-muted-foreground">Request resources, earn karma by fulfilling bounties</p>
          </div>
          <Button className="ml-auto gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Post Bounty
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {typeof t.icon === 'string' ? t.icon : <t.icon className="w-4 h-4" />}
              {t.label}
              {t.id === 'my-requests' && myBounties.created.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{myBounties.created.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filters (only on All tab) */}
        {tab === 'all' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bounties..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="points">Highest Points</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-10 text-destructive text-sm border border-destructive/30 rounded-xl bg-destructive/5 mb-6">
            <p className="font-medium">Failed to load bounties</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>Try Again</Button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !error && displayBounties.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No bounties found</p>
            <p className="text-sm mt-1">Be the first to post a resource request!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayBounties.map(b => (
              <BountyCard
                key={b.id}
                bounty={b}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onClaim={handleClaim}
                onSubmit={setSubmitTarget}
                onApprove={handleApprove}
                onReject={(id) => setRejectTarget(id)}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateBountyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        syllabusNodes={flatNodes}
        classroomId={classroomId}
      />
      {submitTarget && (
        <SubmitBountyModal
          open={!!submitTarget}
          onClose={() => setSubmitTarget(null)}
          bounty={submitTarget}
          onSubmitted={load}
        />
      )}
      <RejectModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={(reason) => handleReject(rejectTarget, reason)}
      />
    </Layout>
  )
}
