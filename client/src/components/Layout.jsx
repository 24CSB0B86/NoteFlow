import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import KarmaWidget from './karma/KarmaWidget'
import { BookOpen, LayoutDashboard, LogOut, GraduationCap, Trophy, BarChart2, User } from 'lucide-react'
import { cn } from '../lib/utils'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isProfessor = user?.role === 'professor'

  const navLinks = [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/classrooms', icon: BookOpen,         label: 'My Classrooms' },
    { to: `/profile/${user?.id}`, icon: User, label: 'My Profile' },
  ]

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border flex flex-col glass fixed left-0 top-0 h-full z-30">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none gradient-text">NoteFlow</h1>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="h-px bg-border/50 my-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 py-1">Features</p>

          {/* Bounty Board — shown inside classroom context via link from classroom page */}
          <div className="px-3 py-2 text-xs text-muted-foreground/60 italic">
            🏹 Bounty Board available inside each classroom
          </div>

          {/* Professor Dashboard shortcut */}
          {isProfessor && (
            <NavLink
              to="#"
              onClick={e => { e.preventDefault() }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            >
              <BarChart2 className="w-4 h-4" />
              Analytics Dashboard
              <span className="ml-auto text-[10px] opacity-60">per-classroom</span>
            </NavLink>
          )}
        </nav>

        {/* Karma Widget + User Info */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Karma inline */}
          <div className="flex justify-center">
            <KarmaWidget />
          </div>

          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
