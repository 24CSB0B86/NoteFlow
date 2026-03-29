import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

const RARITY_STYLES = {
  common:    'border-zinc-500/30 bg-zinc-500/5',
  rare:      'border-blue-500/30 bg-blue-500/5',
  legendary: 'border-amber-500/40 bg-amber-500/10 shadow-amber-500/10',
}

const RARITY_GLOW = {
  common:    '',
  rare:      'shadow-blue-500/20',
  legendary: 'shadow-amber-500/30 shadow-lg',
}

export default function BadgeShowcase({ badges = [], compact = false }) {
  if (badges.length === 0) return null

  return (
    <TooltipProvider>
      <div className={cn('grid gap-3', compact ? 'grid-cols-6' : 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8')}>
        {badges.map(badge => (
          <Tooltip key={badge.id} delayDuration={200}>
            <TooltipTrigger asChild>
              <div className={cn(
                'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-default transition-all',
                badge.earned
                  ? [RARITY_STYLES[badge.rarity], RARITY_GLOW[badge.rarity], 'hover:scale-105']
                  : 'border-border/30 bg-muted/20 opacity-40 grayscale'
              )}>
                <span className="text-2xl leading-none">{badge.icon}</span>
                {!compact && (
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{badge.name}</span>
                )}
                {!badge.earned && (
                  <Lock className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-muted-foreground" />
                )}
                {badge.rarity === 'legendary' && badge.earned && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-black px-1 rounded-full">✨</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div>
                <p className="font-bold">{badge.icon} {badge.name}</p>
                <p className="text-xs opacity-80 mt-0.5">{badge.description}</p>
                <p className={cn('text-xs mt-1 capitalize font-medium', {
                  common: 'text-zinc-400', rare: 'text-blue-400', legendary: 'text-amber-400'
                }[badge.rarity])}>
                  {badge.rarity} rarity
                </p>
                {badge.earned ? (
                  <p className="text-xs text-emerald-400 mt-1">✅ Earned {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : ''}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">🔒 Not yet earned</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
