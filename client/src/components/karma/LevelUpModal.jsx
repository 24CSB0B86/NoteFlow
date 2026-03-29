import { useEffect, useState } from 'react'
import ReactConfetti from 'react-confetti'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Crown, Star } from 'lucide-react'

const LEVEL_NAMES = { 1: 'Novice', 2: 'Contributor', 3: 'Expert', 4: 'Master', 5: 'Legend' }
const LEVEL_ICONS = { 1: '🌱', 2: '📚', 3: '⭐', 4: '🔥', 5: '👑' }
const LEVEL_GRADIENTS = {
  1: 'from-zinc-600 to-zinc-800',
  2: 'from-blue-600 to-blue-800',
  3: 'from-emerald-600 to-emerald-800',
  4: 'from-purple-600 to-purple-800',
  5: 'from-amber-500 to-amber-700',
}

export default function LevelUpModal({ open, level, points, onClose }) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (open) {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(t)
    }
  }, [open])

  return (
    <>
      {showConfetti && (
        <ReactConfetti
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={200}
          recycle={false}
          colors={['#6c63ff', '#a855f7', '#f59e0b', '#10b981', '#3b82f6']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
      )}
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm text-center border-0 bg-transparent shadow-none">
          <div className={`rounded-3xl bg-gradient-to-b ${LEVEL_GRADIENTS[level] || LEVEL_GRADIENTS[1]} p-8 shadow-2xl`}>
            {/* Animated icon */}
            <div className="text-7xl mb-4 animate-bounce">
              {LEVEL_ICONS[level] || '⭐'}
            </div>

            <p className="text-white/70 text-sm font-medium mb-1 uppercase tracking-widest">Level Up!</p>
            <h2 className="text-3xl font-black text-white mb-1">Level {level}</h2>
            <p className="text-xl font-bold text-white/90 mb-4">{LEVEL_NAMES[level] || ''}</p>

            <div className="flex items-center justify-center gap-2 bg-black/20 rounded-2xl px-4 py-2 mb-6">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-white font-semibold">{points} total karma points</span>
            </div>

            <p className="text-white/70 text-sm mb-6 px-2">
              {level === 5
                ? 'You\'ve reached the highest level — you\'re a Legend! 🏆'
                : 'Keep uploading, helping, and engaging to earn more karma!'}
            </p>

            <Button
              onClick={onClose}
              className="w-full bg-white text-black hover:bg-white/90 font-bold"
            >
              {level === 5 ? '👑 Claim Your Crown!' : '🚀 Keep Going!'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
