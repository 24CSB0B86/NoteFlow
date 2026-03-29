import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Loader2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TopicAnalysisTab({ data, loading }) {
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  if (!data?.topics) return null

  const { topics, gaps, mostEngaged } = data

  const chartData = [...topics]
    .filter(t => t.node_type !== 'unit')
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, 10)
    .map(t => ({
      name: t.title.length > 20 ? t.title.slice(0, 18) + '…' : t.title,
      views: parseInt(t.total_views),
      resources: parseInt(t.resource_count),
      isGap: parseInt(t.resource_count) === 0,
    }))

  const coverage = topics.filter(t => t.node_type !== 'unit')
  const pct = coverage.length === 0 ? 0 : Math.round(
    coverage.filter(t => parseInt(t.resource_count) > 0).length / coverage.length * 100
  )

  return (
    <div className="space-y-6">
      {/* Coverage bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass border-border/50 col-span-1">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Syllabus Coverage</p>
            <div className="text-4xl font-black mb-2">{pct}%</div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 col-span-1">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Topics with Resources</p>
            <p className="text-4xl font-black text-emerald-400">{coverage.filter(t => parseInt(t.resource_count) > 0).length}</p>
            <p className="text-xs text-muted-foreground mt-1">of {coverage.length} total</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 col-span-1">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Resource Gaps</p>
            <p className="text-4xl font-black text-red-400">{gaps?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">topics need resources</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement chart */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Topic Engagement (Top 10 by Views)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#888' }} width={140} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              <Bar dataKey="views" radius={[0, 4, 4, 0]} name="Views">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isGap ? '#ef4444' : '#6c63ff'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gaps list */}
      {gaps?.length > 0 && (
        <Card className="glass border-border/50 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" /> Topics Missing Resources ({gaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {gaps.map(g => (
                <div key={g.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-sm truncate">{g.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">{g.node_type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
