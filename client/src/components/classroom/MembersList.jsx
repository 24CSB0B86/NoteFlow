import { useEffect } from 'react'
import { Crown, GraduationCap } from 'lucide-react'
import { useClassroom } from '../../context/ClassroomContext'

function Avatar({ name, role }) {
  const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const isProfessor = role === 'professor'
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${
      isProfessor
        ? 'bg-amber-600/20 border border-amber-500/30 text-amber-400'
        : 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
    }`}>
      {initials}
    </div>
  )
}

export default function MembersList({ classroomId }) {
  const { members, fetchMembers } = useClassroom()

  useEffect(() => {
    if (classroomId) fetchMembers(classroomId)
  }, [classroomId, fetchMembers])

  const professors = members.filter(m => m.role === 'professor')
  const students   = members.filter(m => m.role === 'student')

  const Section = ({ title, icon: Icon, items, emptyMsg }) => (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-500" />
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title} ({items.length})
        </h4>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600 pl-6">{emptyMsg}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(m => (
            <li key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors">
              <Avatar name={m.full_name} role={m.role} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{m.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
              </div>
              <div className="ml-auto text-xs text-slate-600">
                {new Date(m.joined_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div>
      <Section title="Professors" icon={Crown} items={professors} emptyMsg="No professors yet" />
      <Section title="Students" icon={GraduationCap} items={students} emptyMsg="No students have joined yet" />
    </div>
  )
}
