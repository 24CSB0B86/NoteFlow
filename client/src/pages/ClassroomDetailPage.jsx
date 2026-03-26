import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft, Users, TreePine, BarChart2, Crown, Loader2, Share2, AlertTriangle
} from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Button } from '../components/ui/button'
import MembersList from '../components/classroom/MembersList'
import InviteCodeDisplay from '../components/classroom/InviteCodeDisplay'
import SyllabusTree from '../components/syllabus/SyllabusTree'
import GapAnalysisPanel from '../components/syllabus/GapAnalysisPanel'
import { useClassroom } from '../context/ClassroomContext'
import { SyllabusProvider } from '../context/SyllabusContext'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'syllabus', label: 'Syllabus',     icon: TreePine  },
  { id: 'members',  label: 'Members',      icon: Users     },
  { id: 'gaps',     label: 'Gap Analysis', icon: BarChart2 },
]

function ClassroomDetailInner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentClassroom, fetchClassroom, loading, error } = useClassroom()
  const { user, isProfessor } = useAuth()
  const [activeTab, setActiveTab] = useState('syllabus')
  const [showCode, setShowCode]   = useState(false)

  useEffect(() => { fetchClassroom(id) }, [id, fetchClassroom])

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-32 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading classroom…
      </div>
    </DashboardLayout>
  )

  if (error || !currentClassroom) return (
    <DashboardLayout>
      <div className="text-center py-20">
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-white font-medium">{error || 'Classroom not found'}</p>
        <Button onClick={() => navigate('/classrooms')} variant="ghost" className="mt-4 text-slate-400 hover:text-white">
          Back to Classrooms
        </Button>
      </div>
    </DashboardLayout>
  )

  const classroom = currentClassroom
  const isOwner = classroom.professor_id === user?.id

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-5">
          <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link to="/classrooms" className="hover:text-slate-300 transition-colors">Classrooms</Link>
          <span>/</span>
          <span className="text-slate-300">{classroom.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{classroom.name}</h1>
              {classroom.section && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400">
                  {classroom.section}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                {classroom.professor_name}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {classroom.member_count} members
              </span>
            </div>
          </div>
          {isOwner && isProfessor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCode(p => !p)}
              className="border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600/20 gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              Invite Code
            </Button>
          )}
        </div>

        {/* Invite code (expandable) */}
        {showCode && isOwner && (
          <div className="mb-6">
            <InviteCodeDisplay code={classroom.invite_code} />
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-white/10 mb-6">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tid
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'syllabus' && <SyllabusTree classroomId={id} />}
          {activeTab === 'members'  && <MembersList  classroomId={id} />}
          {activeTab === 'gaps'     && <GapAnalysisPanel classroomId={id} />}
        </div>
      </div>
    </DashboardLayout>
  )
}

// Wrap with SyllabusProvider so tree state is local to this page
export default function ClassroomDetailPage() {
  return (
    <SyllabusProvider>
      <ClassroomDetailInner />
    </SyllabusProvider>
  )
}
