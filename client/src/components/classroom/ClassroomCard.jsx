import { useNavigate } from 'react-router-dom'
import { Users, BookOpen, Trash2, Crown } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { useAuth } from '../../context/AuthContext'
import { useClassroom } from '../../context/ClassroomContext'
import InviteCodeDisplay from './InviteCodeDisplay'

export default function ClassroomCard({ classroom }) {
  const navigate = useNavigate()
  const { isProfessor, user } = useAuth()
  const { deleteClassroom } = useClassroom()

  const isOwner = classroom.professor_id === user?.id

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${classroom.name}"? This cannot be undone.`)) return
    await deleteClassroom(classroom.id)
  }

  return (
    <Card
      onClick={() => navigate(`/classrooms/${classroom.id}`)}
      className="border-white/10 bg-slate-900/60 backdrop-blur-sm hover:bg-slate-800/70 hover:border-indigo-500/40 cursor-pointer transition-all duration-200 group"
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
              <BookOpen className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors leading-tight">
                {classroom.name}
              </h3>
              {classroom.section && (
                <p className="text-xs text-slate-500 mt-0.5">{classroom.section}</p>
              )}
            </div>
          </div>
          {isOwner && isProfessor && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              className="h-7 w-7 text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Professor name */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <Crown className="h-3 w-3 text-amber-400" />
          <span>{classroom.professor_name}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            <span>{classroom.member_count} member{classroom.member_count !== 1 ? 's' : ''}</span>
          </div>
          {isOwner && isProfessor && (
            <div onClick={e => e.stopPropagation()}>
              <InviteCodeDisplay code={classroom.invite_code} compact />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
