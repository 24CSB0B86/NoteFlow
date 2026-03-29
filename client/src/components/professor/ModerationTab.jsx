import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Loader2, Trash2, Flag, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTION_LABELS = {
  verify: { label: 'Verified resource', color: 'text-emerald-400', icon: '✅' },
  reject_resource: { label: 'Rejected resource', color: 'text-red-400', icon: '❌' },
  delete_resource: { label: 'Deleted resource', color: 'text-red-500', icon: '🗑️' },
  restore_resource: { label: 'Restored resource', color: 'text-blue-400', icon: '♻️' },
  flag_user: { label: 'Flagged user', color: 'text-orange-400', icon: '🚩' },
  unflag_user: { label: 'Unflagged user', color: 'text-zinc-400', icon: '✔️' },
  delete_discussion: { label: 'Removed discussion', color: 'text-red-400', icon: '💬' },
  restrict_user: { label: 'Restricted user', color: 'text-red-500', icon: '🔒' },
}

export default function ModerationTab({ auditData, loading, onFlagUser, onDeleteDiscussion }) {
  const logs = auditData?.logs || []

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm text-amber-400">Moderation Panel</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All moderation actions are logged permanently. Deleted resources are soft-deleted and can be reviewed.
          </p>
        </div>
      </div>

      {/* Audit Log */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Moderation Audit Log ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Shield className="w-10 h-10 opacity-20" />
              <p className="text-sm">No moderation actions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {logs.map(log => {
                const conf = ACTION_LABELS[log.action] || { label: log.action, color: 'text-muted-foreground', icon: '⚡' }
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <span className="text-lg leading-none mt-0.5">{conf.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-semibold', conf.color)}>{conf.label}</span>
                        <span className="text-xs text-muted-foreground">by {log.moderator_name}</span>
                      </div>
                      {log.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">Reason: {log.reason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60 capitalize px-1.5 py-0.5 bg-muted/50 rounded">
                          {log.target_type}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[120px]">
                          {log.target_id?.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
