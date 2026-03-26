import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'

export default function InviteCodeDisplay({ code, compact = false }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        title={`Invite code: ${code} — click to copy`}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono hover:bg-indigo-600/30 transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {code}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-4 text-center">
      <p className="text-xs text-slate-400 mb-2 uppercase tracking-widest">Class Invite Code</p>
      <div className="text-4xl font-mono font-bold text-white tracking-[0.3em] mb-4">
        {code}
      </div>
      <Button
        onClick={handleCopy}
        variant="outline"
        size="sm"
        className={`border-indigo-500/40 transition-all duration-200 ${
          copied
            ? 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300'
            : 'text-indigo-300 hover:text-white hover:bg-indigo-600/20'
        }`}
      >
        {copied ? (
          <><Check className="h-4 w-4 mr-1.5" /> Copied!</>
        ) : (
          <><Copy className="h-4 w-4 mr-1.5" /> Copy Code</>
        )}
      </Button>
      <p className="text-xs text-slate-500 mt-3">Share this code with students to let them join</p>
    </div>
  )
}
