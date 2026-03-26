import { useEffect, useState } from 'react'
import { Plus, Users, BookOpen, Loader2, FolderOpen } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Button } from '../components/ui/button'
import ClassroomCard from '../components/classroom/ClassroomCard'
import CreateClassroomModal from '../components/classroom/CreateClassroomModal'
import JoinClassroomModal from '../components/classroom/JoinClassroomModal'
import { useClassroom } from '../context/ClassroomContext'
import { useAuth } from '../context/AuthContext'

export default function ClassroomsPage() {
  const { classrooms, loading, error, fetchMyClassrooms } = useClassroom()
  const { isProfessor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)

  useEffect(() => { fetchMyClassrooms() }, [fetchMyClassrooms])

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Classrooms</h1>
            <p className="text-slate-400 mt-1">
              {isProfessor ? 'Manage your classes and track syllabi.' : 'Your enrolled classrooms.'}
            </p>
          </div>
          {isProfessor ? (
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
            >
              <Plus className="h-4 w-4" /> Create Classroom
            </Button>
          ) : (
            <Button
              onClick={() => setShowJoin(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
            >
              <Plus className="h-4 w-4" /> Join Classroom
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : classrooms.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen className="h-16 w-16 text-slate-700 mx-auto mb-4" />
            <p className="text-xl font-semibold text-slate-400 mb-2">No classrooms yet</p>
            <p className="text-slate-600 mb-6 text-sm">
              {isProfessor ? 'Create your first classroom to get started.' : 'Ask your professor for an invite code.'}
            </p>
            {isProfessor ? (
              <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <Plus className="h-4 w-4" /> Create Classroom
              </Button>
            ) : (
              <Button onClick={() => setShowJoin(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <Plus className="h-4 w-4" /> Join Classroom
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map(c => <ClassroomCard key={c.id} classroom={c} />)}
          </div>
        )}
      </div>

      {showCreate && <CreateClassroomModal onClose={() => { setShowCreate(false); fetchMyClassrooms() }} />}
      {showJoin   && <JoinClassroomModal   onClose={() => { setShowJoin(false);   fetchMyClassrooms() }} />}
    </DashboardLayout>
  )
}
