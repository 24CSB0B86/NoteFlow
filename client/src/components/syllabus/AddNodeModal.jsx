import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useSyllabus } from '../../context/SyllabusContext'

const TYPE_OPTIONS = {
  unit:     { label: 'Unit',     desc: 'Top-level section (e.g. Module 1)' },
  topic:    { label: 'Topic',    desc: 'Subject under a unit (e.g. Sorting Algorithms)' },
  subtopic: { label: 'Subtopic', desc: 'Detail under a topic (e.g. QuickSort)' },
}

export default function AddNodeModal({ classroomId, parentNode, onClose }) {
  const { addNode, updateNode } = useSyllabus()

  // If parentNode has _isEdit flag, we're in "rename" mode
  const isEdit = !!parentNode?._isEdit

  const defaultType = parentNode?._isAddChild
    ? (parentNode.node_type === 'unit' ? 'topic' : 'subtopic')
    : 'unit'

  const [title, setTitle]   = useState(isEdit ? parentNode.title : '')
  const [type, setType]     = useState(isEdit ? parentNode.node_type : defaultType)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return setError('Title is required')
    setLoading(true)
    setError('')
    try {
      if (isEdit) {
        await updateNode(classroomId, parentNode.id, { title })
      } else {
        await addNode(classroomId, {
          node_type: type,
          title,
          parent_id: parentNode?._isAddChild ? parentNode.id : null,
        })
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-sm border-white/10 bg-slate-900 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white">
            {isEdit ? 'Rename Node' : parentNode?._isAddChild ? `Add under "${parentNode.title}"` : 'Add Node'}
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label className="text-slate-300">Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_OPTIONS).map(([val, { label }]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setType(val)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        type === val
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                          : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{TYPE_OPTIONS[type]?.desc}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nodeTitle" className="text-slate-300">Title</Label>
              <Input
                id="nodeTitle"
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={`e.g. ${type === 'unit' ? 'Module 1 - Introduction' : type === 'topic' ? 'Recursion' : 'Fibonacci Sequence'}`}
                className="bg-slate-800/60 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}
                className="flex-1 border-white/10 text-slate-300 hover:text-white">
                Cancel
              </Button>
              <Button type="submit" disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Save' : 'Add'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
