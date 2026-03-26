import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { useClassroom } from '../../context/ClassroomContext'
import InviteCodeDisplay from './InviteCodeDisplay'

export default function CreateClassroomModal({ onClose }) {
  const { createClassroom } = useClassroom()
  const [name, setName]         = useState('')
  const [section, setSection]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [created, setCreated]   = useState(null) // classroom object after creation

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setError('Classroom name is required')
    setLoading(true)
    setError('')
    try {
      const classroom = await createClassroom({ name, section })
      setCreated(classroom)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create classroom')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md border-white/10 bg-slate-900 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-white">
              {created ? '🎉 Classroom Created!' : 'Create Classroom'}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {created ? 'Share the invite code with your students.' : 'Set up a new class for your students.'}
            </CardDescription>
          </div>
          <Button
            size="icon" variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent>
          {created ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-slate-800/60 p-3">
                <p className="text-sm text-slate-400">Class</p>
                <p className="font-semibold text-white">{created.name}
                  {created.section && <span className="text-slate-400 font-normal ml-1">· {created.section}</span>}
                </p>
              </div>
              <InviteCodeDisplay code={created.invite_code} />
              <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="className" className="text-slate-300">Class Name *</Label>
                <Input
                  id="className"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="bg-slate-800/60 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section" className="text-slate-300">Section / Batch <span className="text-slate-500">(optional)</span></Label>
                <Input
                  id="section"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                  placeholder="e.g. Section A, Batch 2024"
                  className="bg-slate-800/60 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={onClose}
                  className="flex-1 border-white/10 text-slate-300 hover:text-white">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Class
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
