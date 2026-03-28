import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClassroom } from '../context/ClassroomContext'
import Layout from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Badge } from '../components/ui/badge'
import { Plus, Users, Copy, Check, Trash2, BookOpen, LogIn } from 'lucide-react'

function CreateModal({ onCreate }) {
  const [form, setForm] = useState({ name: '', section: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const c = await onCreate(form)
      setCreated(c)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create classroom')
    } finally { setLoading(false) }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(created.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => { setCreated(null); setForm({ name: '', section: '', description: '' }); setError('') }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4" /> New Classroom</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? '🎉 Classroom Created!' : 'Create Classroom'}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">Share this invite code with your students.</p>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
                <p className="text-3xl font-bold tracking-widest text-primary">{created.invite_code}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={copyCode}>
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </Button>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name</Label>
              <Input id="name" placeholder="e.g. Data Structures" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Input id="section" placeholder="e.g. A, B, or 01" value={form.section}
                onChange={e => setForm(p => ({ ...p, section: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" placeholder="Brief class description" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : 'Create Classroom'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function JoinModal({ onJoin }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  const handleJoin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await onJoin(code.toUpperCase().trim())
      setOpen(false)
      setCode('')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid invite code')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><LogIn className="w-4 h-4" /> Join Classroom</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Join a Classroom</DialogTitle></DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">6-Digit Invite Code</Label>
            <Input
              id="code"
              placeholder="e.g. AB1C2D"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-bold uppercase h-14"
              required
            />
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : 'Join Classroom'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ClassroomsPage() {
  const { user } = useAuth()
  const { classrooms, loading, fetchMyClassrooms, createClassroom, joinClassroom, deleteClassroom } = useClassroom()
  const navigate = useNavigate()

  useEffect(() => { fetchMyClassrooms() }, [fetchMyClassrooms])

  const isProfessor = user?.role === 'professor'

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Classrooms</h1>
            <p className="text-muted-foreground mt-1">
              {isProfessor ? 'Create and manage your classrooms' : 'Classrooms you are enrolled in'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isProfessor
              ? <CreateModal onCreate={createClassroom} />
              : <JoinModal onJoin={joinClassroom} />
            }
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        ) : classrooms.length === 0 ? (
          <Card className="glass border-border/50 border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold mb-1">No classrooms yet</h3>
              <p className="text-muted-foreground text-sm">
                {isProfessor ? 'Click "New Classroom" to create your first one.' : 'Ask your professor for an invite code.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {classrooms.map(c => (
              <Card
                key={c.id}
                className="glass border-border/50 hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 group cursor-pointer"
                onClick={() => navigate(`/classrooms/${c.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    {isProfessor && c.professor_id === user.id && (
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm(`Delete "${c.name}"?`)) deleteClassroom(c.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{c.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Section {c.section}</Badge>
                    {isProfessor && c.professor_id === user.id && (
                      <Badge variant="default" className="text-xs">Owner</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c.member_count} member{c.member_count !== '1' ? 's' : ''}
                    </div>
                    <span>by {c.professor_name}</span>
                  </div>
                  {isProfessor && c.professor_id === user.id && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Invite Code</span>
                      <span className="font-mono font-bold text-primary text-sm tracking-widest">{c.invite_code}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
