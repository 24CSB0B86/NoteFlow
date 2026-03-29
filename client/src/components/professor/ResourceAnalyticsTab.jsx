import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PIE_COLORS = ['#6c63ff', '#a855f7', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']

function VerifyBadge({ status }) {
  return status === true || status === 'approved'
    ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3 h-3" /> Verified</span>
    : <span className="text-xs text-muted-foreground">Pending</span>
}

export default function ResourceAnalyticsTab({ data, loading, onVerify, onDelete }) {
  const [selected, setSelected] = useState([])
  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const allSelected = data?.resources?.length > 0 && selected.length === data.resources.length

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  if (!data) return null

  const { resources, uploadTrend, typeDistribution } = data

  const trendData = uploadTrend?.map(d => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    uploads: parseInt(d.count)
  })) || []

  const pieData = typeDistribution?.map(d => ({ name: d.type, value: parseInt(d.count) })) || []

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Uploads Over Time (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Line type="monotone" dataKey="uploads" stroke="#6c63ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resource Types</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="capitalize">{d.name}</span>
                  <span className="text-muted-foreground ml-auto pl-2">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { onVerify(selected); setSelected([]) }}>
            <CheckCircle className="w-3 h-3" /> Verify All
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => { if (confirm(`Delete ${selected.length} resources?`)) { selected.forEach(id => onDelete(id)); setSelected([]) } }}>
            Delete
          </Button>
        </div>
      )}

      {/* Resources Table */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Resources ({resources?.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="p-3 text-left">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : resources.map(r => r.id))} className="rounded" />
                  </th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Topic</th>
                  <th className="p-3 text-left">Uploader</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Downloads</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {resources?.map(r => (
                  <tr key={r.id} className={cn('hover:bg-muted/20 transition-colors', selected.includes(r.id) && 'bg-primary/5')}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="font-medium truncate max-w-[180px]">{r.file_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.doc_type || r.file_type}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[120px]">{r.node_title || '—'}</td>
                    <td className="p-3 text-xs">{r.uploader_name}</td>
                    <td className="p-3 text-right text-xs">{r.view_count ?? 0}</td>
                    <td className="p-3 text-right text-xs">{r.download_count ?? 0}</td>
                    <td className="p-3"><VerifyBadge status={r.is_verified} /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {!r.is_verified && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onVerify([r.id])}>
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { if (confirm('Delete this resource?')) onDelete(r.id) }}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
