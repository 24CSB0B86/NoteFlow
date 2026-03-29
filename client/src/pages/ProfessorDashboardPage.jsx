import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useClassroom } from '@/context/ClassroomContext'
import Layout from '@/components/Layout'
import OverviewTab from '@/components/professor/OverviewTab'
import ResourceAnalyticsTab from '@/components/professor/ResourceAnalyticsTab'
import StudentAnalyticsTab from '@/components/professor/StudentAnalyticsTab'
import TopicAnalysisTab from '@/components/professor/TopicAnalysisTab'
import VerificationQueueTab from '@/components/professor/VerificationQueueTab'
import ModerationTab from '@/components/professor/ModerationTab'
import Leaderboard from '@/components/karma/Leaderboard'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, BookOpen, Users, BarChart2, CheckCircle,
  Shield, ArrowLeft, Trophy, RefreshCw, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',          icon: LayoutDashboard },
  { id: 'resources',   label: 'Resources',          icon: BookOpen },
  { id: 'students',    label: 'Students',           icon: Users },
  { id: 'topics',      label: 'Topic Analysis',     icon: BarChart2 },
  { id: 'leaderboard', label: 'Leaderboard',        icon: Trophy },
  { id: 'verify',      label: 'Verification Queue', icon: CheckCircle },
  { id: 'moderation',  label: 'Moderation',         icon: Shield },
]

export default function ProfessorDashboardPage() {
  const { classroomId } = useParams()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { fetchClassroom, currentClassroom } = useClassroom()

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({})
  const [pendingCount, setPendingCount] = useState(0)

  // Get auth headers with localStorage fallback
  const getHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    console.log('[ProfDashboard] Building auth headers – token present:', !!token)
    return { Authorization: `Bearer ${token}` }
  }, [session])

  // Guard: professor only
  useEffect(() => {
    if (user && user.role !== 'professor') {
      console.warn('[ProfDashboard] Access denied – user role:', user.role)
      navigate('/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    console.log('[ProfDashboard] Fetching classroom:', classroomId)
    fetchClassroom(classroomId)
  }, [classroomId])

  const loadTab = useCallback(async (tab) => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    if (!token) {
      console.warn('[ProfDashboard] No auth token – cannot load tab:', tab)
      setLoading(false)
      return
    }

    setLoading(true)
    const headers = { Authorization: `Bearer ${token}` }

    try {
      let endpoint
      if (tab === 'overview')   endpoint = `/api/analytics/${classroomId}/overview`
      if (tab === 'resources')  endpoint = `/api/analytics/${classroomId}/resources`
      if (tab === 'students')   endpoint = `/api/analytics/${classroomId}/students`
      if (tab === 'topics')     endpoint = `/api/analytics/${classroomId}/topics`
      if (tab === 'verify')     endpoint = `/api/verify/queue/${classroomId}`
      if (tab === 'moderation') endpoint = `/api/moderate/logs/${classroomId}`

      if (endpoint) {
        console.log(`[ProfDashboard] GET ${endpoint}`)
        const res = await axios.get(`${API}${endpoint}`, { headers })
        console.log(`[ProfDashboard] ✅ Tab "${tab}" loaded – keys:`, Object.keys(res.data))
        setData(prev => ({ ...prev, [tab]: res.data }))
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      console.error(`[ProfDashboard] ❌ Tab "${tab}" load failed – status:`, err.response?.status, '– error:', msg)
    } finally {
      setLoading(false)
    }
  }, [classroomId, session])

  useEffect(() => {
    console.log('[ProfDashboard] Active tab changed to:', activeTab)
    loadTab(activeTab)
  }, [activeTab, loadTab])

  // Load pending verification count for sidebar badge
  useEffect(() => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    if (!token || !classroomId) return
    const headers = { Authorization: `Bearer ${token}` }
    console.log('[ProfDashboard] GET /api/verify/queue/:classroomId (for badge count)')
    axios.get(`${API}/api/verify/queue/${classroomId}`, { headers })
      .then(r => {
        const count = r.data.queue?.length || 0
        console.log('[ProfDashboard] ✅ Pending verifications:', count)
        setPendingCount(count)
      })
      .catch(err => console.warn('[ProfDashboard] Could not load pending count:', err.response?.status))
  }, [classroomId, session])

  const handleVerify = async (ids) => {
    console.log('[ProfDashboard] POST /api/verify/batch – ids:', ids)
    try {
      await axios.post(`${API}/api/verify/batch`, { resourceIds: ids }, { headers: getHeaders() })
      console.log('[ProfDashboard] ✅ Batch verify success for', ids.length, 'resources')
      loadTab(activeTab)
      setPendingCount(p => Math.max(0, p - ids.length))
    } catch (err) {
      console.error('[ProfDashboard] ❌ Batch verify failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleRejectVerify = async (id, reason) => {
    console.log(`[ProfDashboard] POST /api/verify/${id}/reject – reason:`, reason)
    try {
      await axios.post(`${API}/api/verify/${id}/reject`, { reason }, { headers: getHeaders() })
      console.log(`[ProfDashboard] ✅ Rejected resource ${id}`)
      loadTab(activeTab)
    } catch (err) {
      console.error('[ProfDashboard] ❌ Reject verification failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Rejection failed')
    }
  }

  const handleDeleteResource = async (id, reason = '') => {
    console.log(`[ProfDashboard] DELETE /api/moderate/resource/${id} – reason:`, reason)
    try {
      await axios.delete(`${API}/api/moderate/resource/${id}`, { data: { reason }, headers: getHeaders() })
      console.log(`[ProfDashboard] ✅ Deleted resource ${id}`)
      loadTab(activeTab)
    } catch (err) {
      console.error('[ProfDashboard] ❌ Delete resource failed:', err.response?.data?.error)
      alert(err.response?.data?.error || 'Delete failed')
    }
  }

  const tabData = data[activeTab]

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border/50 bg-card/30 flex flex-col py-4 gap-1 px-2">
          {/* Back */}
          <Link
            to={`/classrooms/${classroomId}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Classroom
          </Link>

          <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {currentClassroom?.name || 'Dashboard'}
          </p>

          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all relative text-left',
                activeTab === item.id
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.id === 'verify' && pendingCount > 0 && (
                <span className="ml-auto bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Header bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold capitalize">{activeTab.replace(/-/g, ' ')}</h1>
                <p className="text-sm text-muted-foreground">{currentClassroom?.name} · Professor Analytics</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => loadTab(activeTab)}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>

            {/* Tab content */}
            {activeTab === 'overview'    && <OverviewTab data={tabData} loading={loading} />}
            {activeTab === 'resources'   && (
              <ResourceAnalyticsTab
                data={tabData} loading={loading}
                onVerify={handleVerify}
                onDelete={(id) => handleDeleteResource(id)}
              />
            )}
            {activeTab === 'students'    && <StudentAnalyticsTab data={tabData} loading={loading} />}
            {activeTab === 'topics'      && <TopicAnalysisTab data={tabData} loading={loading} />}
            {activeTab === 'leaderboard' && <div className="max-w-xl"><Leaderboard classroomId={classroomId} /></div>}
            {activeTab === 'verify'      && (
              <VerificationQueueTab
                data={tabData} loading={loading}
                onVerify={handleVerify}
                onReject={handleRejectVerify}
              />
            )}
            {activeTab === 'moderation'  && <ModerationTab auditData={tabData} loading={loading} />}
          </div>
        </main>
      </div>
    </Layout>
  )
}
