import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClassroom } from '../context/ClassroomContext'
import Layout from '../components/Layout'
import { BookOpen, Users, GraduationCap, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function DashboardPage() {
  const { user } = useAuth()
  const { classrooms, fetchMyClassrooms, loading } = useClassroom()
  const navigate = useNavigate()

  useEffect(() => { fetchMyClassrooms() }, [fetchMyClassrooms])

  const totalMembers = classrooms.reduce((acc, c) => acc + parseInt(c.member_count || 0), 0)

  const stats = [
    { label: 'Classrooms', value: classrooms.length, icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Role', value: user?.role === 'professor' ? 'Professor' : 'Student', icon: GraduationCap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Resources', value: '—', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
  ]

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="gradient-text">{user?.full_name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'professor'
              ? 'Manage your classrooms and track student progress'
              : 'Access your course materials and resources'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="glass border-border/50 hover:border-primary/30 transition-all duration-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{loading ? '—' : value}</div>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Classrooms */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Classrooms</h2>
          {loading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading classrooms…
            </div>
          ) : classrooms.length === 0 ? (
            <Card className="glass border-border/50 border-dashed">
              <CardContent className="pt-8 pb-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No classrooms yet.</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {user?.role === 'professor' ? 'Create your first classroom to get started.' : 'Join a classroom with an invite code.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {classrooms.slice(0, 6).map(c => (
                <Card
                  key={c.id}
                  onClick={() => navigate(`/classrooms/${c.id}`)}
                  className="glass border-border/50 hover:border-primary/40 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">Section {c.section}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {c.member_count} member{c.member_count !== '1' ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
