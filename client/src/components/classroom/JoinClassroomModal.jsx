import { useState, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { useClassroom } from '../../context/ClassroomContext'

export default function JoinClassroomModal({ onClose }) {
  const { joinClassroom } = useClassroom()
  const [code, setCode]     = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(null)
  const inputs = useRef([])

  const handleChange = (i, val) => {
    const v = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!v && val === '') {
      // backspace — move focus left
      const next = [...code]
      next[i] = ''
      setCode(next)
      if (i > 0) inputs.current[i - 1]?.focus()
      return
    }
    if (v.length === 0) return
    const next = [...code]
    next[i] = v[0]
    setCode(next)
    if (i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    const next = [...code]
    pasted.split('').forEach((c, i) => { if (i < 6) next[i] = c })
    setCode(next)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fullCode = code.join('')
    if (fullCode.length < 6) return setError('Please enter the full 6-character code')
    setLoading(true)
    setError('')
    try {
      const classroom = await joinClassroom(fullCode)
      setSuccess(classroom)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-sm border-white/10 bg-slate-900 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-white">
              {success ? '✅ Joined!' : 'Join a Classroom'}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {success ? `You've joined ${success.name}` : "Enter the 6-character code from your professor."}
            </CardDescription>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-600/10 p-4">
                <p className="font-semibold text-white text-lg">{success.name}</p>
                {success.section && <p className="text-slate-400 text-sm">{success.section}</p>}
                <p className="text-xs text-slate-500 mt-1">by {success.professor_name}</p>
              </div>
              <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Go to My Classes
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" onPaste={handlePaste}>
              <div className="flex gap-2 justify-between">
                {code.map((char, i) => (
                  <input
                    key={i}
                    ref={el => (inputs.current[i] = el)}
                    maxLength={1}
                    value={char}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-10 h-12 text-center text-xl font-mono font-bold text-white bg-slate-800 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors uppercase"
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose}
                  className="flex-1 border-white/10 text-slate-300 hover:text-white">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || code.join('').length < 6}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Join
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
