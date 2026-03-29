import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Star, Bell, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const LEVEL_COLORS = {
  1: 'text-zinc-400',
  2: 'text-blue-400',
  3: 'text-emerald-400',
  4: 'text-purple-400',
  5: 'text-amber-400',
}

export default function KarmaWidget() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [karma, setKarma] = useState(null)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  const headers = { Authorization: `Bearer ${session?.access_token}` }

  useEffect(() => {
    if (!user || !session) return
    const load = async () => {
      try {
        const [karmaRes, notifRes] = await Promise.all([
          axios.get(`${API}/api/karma/${user.id}`, { headers }),
          axios.get(`${API}/api/karma/notifications`, { headers }),
        ])
        setKarma(karmaRes.data.karma)
        setUnread(notifRes.data.unreadCount)
        setNotifications(notifRes.data.notifications)
      } catch (e) { /* silent */ }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user?.id, session])

  const markRead = async () => {
    if (unread === 0) return
    await axios.post(`${API}/api/karma/notifications/read`, {}, { headers })
    setUnread(0)
  }

  if (!user || !karma) return null

  return (
    <div className="flex items-center gap-2">
      {/* Karma points chip */}
      <button
        onClick={() => navigate(`/profile/${user.id}`)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all"
      >
        <Star className={cn('w-3.5 h-3.5', LEVEL_COLORS[karma.level] || 'text-primary')} />
        <span className="text-sm font-semibold">{karma.total_points}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">pts · Lv.{karma.level}</span>
      </button>

      {/* Notifications bell */}
      <div className="relative">
        <button
          onClick={() => { setShowNotifs(v => !v); markRead() }}
          className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showNotifs && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
            <div className="absolute right-0 top-10 w-80 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">Notifications</span>
                <span className="text-xs text-muted-foreground">{unread} unread</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">No notifications yet</div>
                ) : notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    onClick={() => { setShowNotifs(false); n.link && navigate(n.link) }}
                    className={cn(
                      'px-4 py-3 border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors',
                      !n.is_read && 'bg-primary/5'
                    )}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
