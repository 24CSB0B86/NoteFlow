import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import AITestGeneratorModal from '../components/exam/AITestGeneratorModal'
import {
  ArrowLeft, Upload, Download, CheckCircle, XCircle, Clock, FileText,
  BookOpen, Trophy, Play, Eye, Loader2, AlertCircle, RefreshCw, PlusCircle,
  GraduationCap, Star, Timer, ChevronRight, ChevronLeft, Award, Wand2
} from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'

const RESOURCE_TYPES = [
  { value: 'pyq', label: 'Previous Year Questions (PYQ)' },
  { value: 'important_questions', label: 'Important Questions' },
  { value: 'quick_revision', label: 'Quick Revision Notes' },
  { value: 'other', label: 'Other' },
]

function statusBadge(status) {
  if (status === 'approved') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✅ Approved</Badge>
  if (status === 'pending') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pending Review</Badge>
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Rejected</Badge>
}

// ── Upload Exam Resource Modal ─────────────────────────────────────────────────
function UploadModal({ open, onClose, sectionId, onUploaded }) {
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ resource_type: 'pyq', year: '', topic_coverage: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return setError('Please select a file')
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v))
      await api.post(`/api/exam/section/${sectionId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onUploaded()
      onClose()
      setFile(null)
      setForm({ resource_type: 'pyq', year: '', topic_coverage: '', description: '' })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Exam Resource</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-2 justify-center">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to select PDF or DOCX</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Max 50MB</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx" onChange={e => setFile(e.target.files[0])} />
          </div>

          <div className="space-y-1.5">
            <Label>Resource Type</Label>
            <select
              value={form.resource_type}
              onChange={e => setForm(p => ({ ...p, resource_type: e.target.value }))}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Year (optional)</Label>
              <Input
                type="number" placeholder="e.g. 2023"
                value={form.year}
                onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Topic Coverage (optional)</Label>
              <Input
                placeholder="e.g. Unit 1-3"
                value={form.topic_coverage}
                onChange={e => setForm(p => ({ ...p, topic_coverage: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Brief description of this resource..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Review'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Revision Test Runner Modal ─────────────────────────────────────────────────
function TestRunnerModal({ open, onClose, testId, onCompleted }) {
  const [testData, setTestData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const startTime = useRef(Date.now())
  const timerRef = useRef()

  useEffect(() => {
    if (!open || !testId) return
    setLoading(true); setError(''); setResults(null); setAnswers({}); setCurrentQ(0)
    api.get(`/api/exam/test/${testId}`)
      .then(({ data }) => {
        setTestData(data)
        const secs = (data.test.duration_mins || 30) * 60
        setTimeLeft(secs)
        startTime.current = Date.now()
      })
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [open, testId])

  // Countdown timer
  useEffect(() => {
    if (!testData || results) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          handleSubmit(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [testData, results])

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirm('Submit test now?')) return
    clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
      const { data } = await api.post(`/api/exam/test/${testId}/submit`, { answers, time_taken_sec: timeTaken })
      setResults(data)
      onCompleted?.()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally { setSubmitting(false) }
  }

  const formatTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  const q = testData?.questions?.[currentQ]
  const answered = Object.keys(answers).length
  const total = testData?.questions?.length || 0

  return (
    <Dialog open={open} onOpenChange={results ? onClose : undefined}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : results ? (
          // ── Results View ────────────────────────────────────────────────────
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" /> Test Results
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <div className="text-5xl font-bold mb-2">{results.percentage}%</div>
              <p className="text-muted-foreground">{results.score} / {results.total} correct</p>
              <div className={cn(
                'inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-sm font-medium',
                results.percentage >= 75 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              )}>
                <Star className="w-4 h-4" /> +{results.karmaAwarded} karma earned
              </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {results.feedback?.map((f, i) => (
                <div key={f.questionId} className={cn(
                  'p-3 rounded-xl border text-sm space-y-2',
                  f.isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
                )}>
                  <div className="flex items-start gap-2">
                    {f.isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    <span className="font-medium">Q{i + 1}: {f.question}</span>
                  </div>
                  {!f.isCorrect && (
                    <div className="ml-6 text-xs text-muted-foreground space-y-1">
                      <p>Your answer: <span className="text-red-400">{f.options?.find(o => o.id === f.studentAnswer)?.text || 'Not answered'}</span></p>
                      <p>Correct: <span className="text-emerald-400">{f.options?.find(o => o.id === f.correctAnswer)?.text}</span></p>
                      {f.explanation && <p className="italic">{f.explanation}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          // ── Test View ────────────────────────────────────────────────────────
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{testData?.test?.title}</span>
                <span className={cn(
                  'flex items-center gap-1.5 text-sm font-mono px-3 py-1 rounded-full',
                  timeLeft < 60 ? 'bg-red-500/20 text-red-400' : 'bg-primary/10 text-primary'
                )}>
                  <Timer className="w-3.5 h-3.5" /> {formatTime(timeLeft)}
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question {currentQ + 1} of {total}</span>
              <span>{answered} answered</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
            </div>

            {/* Question */}
            {q && (
              <div className="space-y-4">
                <p className="font-medium text-base leading-relaxed">{q.question}</p>
                <div className="space-y-2">
                  {(q.options || []).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                        answers[q.id] === opt.id
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/40 hover:bg-accent/50'
                      )}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentQ(p => Math.max(0, p - 1))} disabled={currentQ === 0}>
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              {currentQ < total - 1 ? (
                <Button size="sm" onClick={() => setCurrentQ(p => Math.min(total - 1, p + 1))}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleSubmit()} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Test <CheckCircle className="w-4 h-4 ml-1" /></>}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Exam Resource Card ─────────────────────────────────────────────────────────
function ExamResourceCard({ resource, isProfessor, onDownload, onApprove, onReject, currentUserId }) {
  const typeLabel = RESOURCE_TYPES.find(t => t.value === resource.resource_type)?.label || resource.resource_type
  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" title={resource.file_name}>{resource.file_name}</p>
            <p className="text-xs text-muted-foreground">{resource.uploader_name} · {typeLabel}</p>
          </div>
          {statusBadge(resource.status)}
        </div>

        {resource.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{resource.description}</p>
        )}

        <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
          {resource.year && <span className="bg-muted/50 px-2 py-0.5 rounded-full">{resource.year}</span>}
          {resource.topic_coverage && <span className="bg-muted/50 px-2 py-0.5 rounded-full">{resource.topic_coverage}</span>}
          <span className="bg-muted/50 px-2 py-0.5 rounded-full">{(resource.file_size / 1024 / 1024).toFixed(1)} MB</span>
          {resource.download_count > 0 && <span className="bg-muted/50 px-2 py-0.5 rounded-full">↓ {resource.download_count}</span>}
        </div>

        {resource.status === 'rejected' && resource.reject_reason && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            Rejection reason: {resource.reject_reason}
          </p>
        )}

        <div className="flex gap-2">
          {(resource.status === 'approved' || resource.uploader_id === currentUserId || isProfessor) && (
            <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => onDownload(resource)}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          )}
          {isProfessor && resource.status === 'pending' && (
            <>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => onApprove(resource.id)}>
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 flex-1" onClick={() => onReject(resource)}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Revision Test Card ─────────────────────────────────────────────────────────
function TestCard({ test, onStart }) {
  const attemptsLeft = test.max_attempts - parseInt(test.my_attempts || 0)
  const bestScore = test.my_best_score ? parseFloat(test.my_best_score).toFixed(1) : null

  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">{test.title}</h3>
            {test.description && <p className="text-xs text-muted-foreground mt-0.5">{test.description}</p>}
          </div>
          {bestScore && (
            <div className="text-right shrink-0">
              <div className={cn('text-lg font-bold', parseFloat(bestScore) >= 75 ? 'text-emerald-400' : 'text-amber-400')}>
                {bestScore}%
              </div>
              <div className="text-xs text-muted-foreground">Best</div>
            </div>
          )}
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {test.duration_mins}min</span>
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {test.question_count || test.total_questions} Qs</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {attemptsLeft}/{test.max_attempts} attempts left</span>
        </div>

        {test.topics_covered?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {test.topics_covered.map(t => (
              <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => onStart(test.id)}
          disabled={attemptsLeft <= 0}
        >
          {attemptsLeft <= 0
            ? '✅ Max Attempts Reached'
            : <><Play className="w-3.5 h-3.5" /> Start Test ({attemptsLeft} left)</>
          }
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Main Exam Section Page ─────────────────────────────────────────────────────
export default function ExamSectionPage() {
  const { classroomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isProfessor = user?.role === 'professor'

  const [sections, setSections] = useState([])
  const [activeSection, setActiveSection] = useState(null) // selected exam section
  const [resources, setResources] = useState([])
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [resLoading, setResLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('resources') // 'resources' | 'tests'
  const [showUpload, setShowUpload] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [activeTestId, setActiveTestId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Load sections
  useEffect(() => {
    api.get(`/api/exam/${classroomId}/sections`)
      .then(({ data }) => {
        setSections(data.sections || [])
        if (data.sections?.length > 0) setActiveSection(data.sections[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [classroomId])

  // Load resources and tests for active section
  const loadSectionData = useCallback(async () => {
    if (!activeSection) return
    setResLoading(true)
    try {
      const [resRes, testRes] = await Promise.all([
        api.get(`/api/exam/section/${activeSection.id}/resources`),
        api.get(`/api/exam/section/${activeSection.id}/tests`),
      ])
      setResources(resRes.data.resources || [])
      setTests(testRes.data.tests || [])
    } catch (err) {
      console.error(err)
    } finally { setResLoading(false) }
  }, [activeSection])

  useEffect(() => { loadSectionData() }, [loadSectionData])

  const handleDownload = async (resource) => {
    try {
      const { data } = await api.get(`/api/exam/resource/${resource.id}/download`)
      const a = document.createElement('a'); a.href = data.url; a.download = data.fileName; a.click()
    } catch (err) { alert(err.response?.data?.error || 'Download failed') }
  }

  const handleApprove = async (resourceId) => {
    try {
      await api.post(`/api/exam/resource/${resourceId}/approve`)
      loadSectionData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to approve') }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    try {
      await api.post(`/api/exam/resource/${rejectTarget.id}/reject`, { reason: rejectReason })
      setRejectTarget(null); setRejectReason('')
      loadSectionData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to reject') }
  }

  const pendingCount = resources.filter(r => r.status === 'pending').length

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={`/classrooms/${classroomId}`} className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Classroom
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Exam Section</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <GraduationCap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Exam Section</h1>
              <p className="text-sm text-muted-foreground">PYQs, Important Questions, and Revision Tests</p>
            </div>
          </div>
          {isProfessor && pendingCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm px-3 py-1">
              {pendingCount} pending review
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Exam type tabs (Midterm / Endterm) */}
            <div className="flex gap-2">
              {sections.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border',
                    sec.id === activeSection?.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  )}
                >
                  {sec.exam_type === 'midterm'
                    ? <><BookOpen className="w-4 h-4" /> Midterm</>
                    : <><Trophy className="w-4 h-4" /> Endterm</>
                  }
                  {parseInt(sec.resource_count) > 0 && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full', sec.id === activeSection?.id ? 'bg-white/20' : 'bg-muted')}>
                      {sec.resource_count}
                    </span>
                  )}
                  {isProfessor && parseInt(sec.pending_count) > 0 && (
                    <span className="text-xs bg-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full">
                      {sec.pending_count} ⏳
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeSection && (
              <>
                {/* Sub-tabs: Resources | Revision Tests */}
                <div className="flex gap-1 border-b border-border">
                  {[
                    { id: 'resources', label: 'Resources', icon: FileText },
                    { id: 'tests', label: `Revision Tests (${tests.length})`, icon: Play },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                        activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* Resources Tab */}
                {activeTab === 'resources' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        {activeSection.exam_type === 'midterm' ? 'Midterm' : 'Endterm'} Resources ({resources.length})
                      </h2>
                      <Button size="sm" className="gap-1.5" onClick={() => setShowUpload(true)}>
                        <Upload className="w-3.5 h-3.5" /> Upload Resource
                      </Button>
                    </div>

                    {resLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : resources.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-medium text-muted-foreground">No resources yet</p>
                        <p className="text-sm text-muted-foreground/60 mb-4">Upload PYQs, important questions, or revision notes</p>
                        <Button size="sm" onClick={() => setShowUpload(true)}>
                          <Upload className="w-4 h-4 mr-2" /> Upload First Resource
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resources.map(r => (
                          <ExamResourceCard
                            key={r.id}
                            resource={r}
                            isProfessor={isProfessor}
                            currentUserId={user?.id}
                            onDownload={handleDownload}
                            onApprove={handleApprove}
                            onReject={setRejectTarget}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Revision Tests Tab */}
                {activeTab === 'tests' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Revision Tests ({tests.length})
                      </h2>
                      {isProfessor && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                            onClick={() => setShowAIGenerator(true)}>
                            <Wand2 className="w-3.5 h-3.5" /> Generate with AI
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => navigate(`/classrooms/${classroomId}/exam/create-test/${activeSection.id}`)}>
                            <PlusCircle className="w-3.5 h-3.5" /> Create Test
                          </Button>
                        </div>
                      )}
                    </div>

                    {tests.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                        <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-medium text-muted-foreground">No revision tests yet</p>
                        {isProfessor && (
                          <p className="text-sm text-muted-foreground/60 mb-4">Create a timed test for students</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tests.map(t => (
                          <TestCard key={t.id} test={t} onStart={setActiveTestId} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        sectionId={activeSection?.id}
        onUploaded={loadSectionData}
      />

      {/* AI Test Generator Modal */}
      <AITestGeneratorModal
        open={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        sectionId={activeSection?.id}
        resources={resources}
        onGenerated={() => {
          loadSectionData()
          setShowAIGenerator(false)
        }}
      />

      {/* Test Runner */}
      <TestRunnerModal
        open={!!activeTestId}
        onClose={() => setActiveTestId(null)}
        testId={activeTestId}
        onCompleted={loadSectionData}
      />

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectReason('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Resource</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason for rejection</Label>
              <Textarea
                placeholder="Explain why this resource is being rejected..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={handleReject} className="flex-1">Reject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
