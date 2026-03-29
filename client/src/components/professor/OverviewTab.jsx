import { Users, BookOpen, Download, Clock, Upload, Star, TrendingUp, CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function KPICard({ label, value, icon: Icon, color = 'text-primary', sub }) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-3xl font-black mt-1">{value ?? '—'}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl bg-muted/50', color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const EVENT_ICONS = {
  upload: '📁', download: '⬇️', view: '👁️', discussion_post: '💬',
  bounty_create: '🏹', bounty_fulfill: '✅', highlight: '🖊️'
}

export default function OverviewTab({ data, loading }) {
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
  if (!data) return null

  const { kpis, topContributors, recentActivity } = data

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Students" value={kpis.students} icon={Users} color="text-blue-400" />
        <KPICard label="Resources" value={kpis.resources} icon={BookOpen} color="text-emerald-400" />
        <KPICard label="Downloads" value={kpis.downloads} icon={Download} color="text-purple-400" />
        <KPICard label="Discussions" value={kpis.discussions} icon={Star} color="text-sky-400" />
        <KPICard label="Pending Verif." value={kpis.pendingVerifications} icon={CheckCircle} color="text-amber-400" sub="need review" />
        <KPICard label="New This Week" value={kpis.newUploadsThisWeek} icon={Upload} color="text-pink-400" sub="uploads" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Contributors */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" /> Top Contributors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topContributors?.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={c.avatar_url} />
                  <AvatarFallback className="text-xs">{c.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">{c.upload_count} uploads</p>
                </div>
                <span className="text-sm font-bold text-amber-400">{c.total_points ?? 0} pts</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border/40">
            {recentActivity?.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">No activity yet</div>
            )}
            {recentActivity?.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="text-base w-6 text-center">{EVENT_ICONS[e.event_type] || '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{e.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.event_type.replace(/_/g, ' ')} {e.file_name ? `· ${e.file_name}` : ''}</p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
