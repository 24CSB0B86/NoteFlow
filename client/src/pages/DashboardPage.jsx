import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../components/layout/DashboardLayout'
import { BookOpen, Users, FolderOpen, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Link } from 'react-router-dom'

const stats = [
  { label: 'Classrooms',  value: '0', icon: FolderOpen,  color: 'text-indigo-400', bg: 'bg-indigo-600/20 border-indigo-500/30' },
  { label: 'Students',    value: '0', icon: Users,        color: 'text-violet-400', bg: 'bg-violet-600/20 border-violet-500/30' },
  { label: 'Resources',   value: '0', icon: BookOpen,     color: 'text-cyan-400',   bg: 'bg-cyan-600/20 border-cyan-500/30'     },
  { label: 'This Week',   value: '0', icon: TrendingUp,   color: 'text-emerald-400',bg: 'bg-emerald-600/20 border-emerald-500/30'},
]

export default function DashboardPage() {
  const { user, isProfessor } = useAuth()

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-400">
            {isProfessor
              ? 'Manage your classrooms and share resources with students.'
              : 'Access your classrooms and learning materials.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className={`border bg-slate-900/60 border-white/10 backdrop-blur-sm`}>
              <CardContent className="p-5">
                <div className={`inline-flex p-2.5 rounded-lg border ${bg} mb-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-sm text-slate-500 mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-white/10 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isProfessor ? (
                <>
                  <Link to="/classrooms/new">
                    <Button className="w-full justify-between bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white" variant="ghost">
                      <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Create Classroom</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/classrooms">
                    <Button className="w-full justify-between text-slate-300 hover:text-white border border-white/10" variant="ghost">
                      <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> View All Classrooms</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/classrooms/join">
                    <Button className="w-full justify-between bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white" variant="ghost">
                      <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Join a Classroom</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/classrooms">
                    <Button className="w-full justify-between text-slate-300 hover:text-white border border-white/10" variant="ghost">
                      <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> My Classrooms</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-white text-lg">Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xl font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-semibold text-white">{user?.full_name}</p>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
              <Link to="/settings">
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300 hover:text-white hover:bg-white/10">
                  Edit Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
