import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/button'
import {
  BookOpen,
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../../utils/cn'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/classrooms',  label: 'Classrooms', icon: FolderOpen },
  { to: '/members',     label: 'Members',    icon: Users, professorOnly: true },
  { to: '/settings',    label: 'Settings',   icon: Settings },
]

export default function DashboardLayout({ children }) {
  const { user, signOut, isProfessor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const filteredNav = navItems.filter((item) => !item.professorOnly || isProfessor)

  const Sidebar = ({ mobile = false }) => (
    <div className={cn(
      'flex flex-col h-full bg-slate-900 border-r border-white/10',
      mobile ? 'w-72' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/10">
        <div className="p-1.5 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/30">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">NoteFlow</span>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-indigo-400' : 'group-hover:text-white')} />
              {label}
              {active && <ChevronRight className="h-3 w-3 ml-auto text-indigo-400" />}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-500/30 shrink-0">
            <span className="text-xs font-semibold text-indigo-400">
              {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
            <div className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3 text-slate-500" />
              <p className="text-xs text-slate-500 capitalize">{user?.role || '—'}</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 animate-slide-in">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="flex items-center gap-4 px-4 py-3 border-b border-white/10 bg-slate-900 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-indigo-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">NoteFlow</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 text-white">
          {children}
        </main>
      </div>
    </div>
  )
}
