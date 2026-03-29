import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Flame } from 'lucide-react'

const LEVEL_NAMES = { 1: 'Novice', 2: 'Contributor', 3: 'Expert', 4: 'Master', 5: 'Legend' }

function exportCSV(students) {
  const headers = 'Name,Email,Uploads,Karma,Discussions,Last Active'
  const rows = students.map(s =>
    `"${s.full_name}","${s.email}",${s.uploads},${s.karma_points},${s.discussions},${s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Never'}`
  )
  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click()
}

export default function StudentAnalyticsTab({ data, loading }) {
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  if (!data?.students) return null

  const { students } = data
  const chartData = [...students]
    .sort((a, b) => b.karma_points - a.karma_points)
    .slice(0, 10)
    .map(s => ({ name: s.full_name.split(' ')[0], karma: parseInt(s.karma_points), uploads: parseInt(s.uploads) }))

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top 10 Contributors by Karma</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#888' }} width={70} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              <Bar dataKey="karma" fill="#6c63ff" radius={[0, 4, 4, 0]} name="Karma Points" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Export + Table */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(students)}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="p-3 text-left">Student</th>
                  <th className="p-3 text-right">Karma</th>
                  <th className="p-3 text-right">Uploads</th>
                  <th className="p-3 text-right">Discussions</th>
                  <th className="p-3 text-right">Bounties</th>
                  <th className="p-3 text-left">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {students.map((s, i) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage src={s.avatar_url} />
                          <AvatarFallback className="text-xs">{s.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-xs">{s.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">{LEVEL_NAMES[s.level] || 'Novice'}</div>
                        </div>
                        {s.login_streak >= 7 && <Flame className="w-3 h-3 text-orange-400" title={`${s.login_streak}-day streak`} />}
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-amber-400">{s.karma_points}</td>
                    <td className="p-3 text-right text-xs">{s.uploads}</td>
                    <td className="p-3 text-right text-xs">{s.discussions}</td>
                    <td className="p-3 text-right text-xs">{s.bounties_fulfilled}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Never'}
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
