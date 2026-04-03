import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClassroom } from '../context/ClassroomContext'
import { useSyllabus } from '../context/SyllabusContext'
import Layout from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import ResourceList from '../components/resources/ResourceList'
import {
  Users, ChevronRight, ChevronDown, Plus, Trash2,
  FileText, AlertCircle, CheckCircle, BarChart2, ArrowLeft, FolderOpen, Trophy, GraduationCap, BookOpen
} from 'lucide-react'
import { cn } from '../lib/utils'

// ── Syllabus Node (recursive) ─────────────────────────────────────────────────
function SyllabusNodeItem({ node, isProfessor, onAdd, onDelete, onSelectNode, selectedNodeId, depth = 0 }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children?.length > 0
  const resourceCount = parseInt(node.resource_count || 0)
  const isGap = resourceCount === 0 && node.node_type !== 'unit'
  const isSelected = selectedNodeId === node.id

  return (
    <div className={cn('animate-fade-in', depth > 0 && 'ml-5 border-l border-border pl-4')}>
      <div className={cn(
        'flex items-center gap-2 py-2 px-3 rounded-lg group hover:bg-accent/50 transition-colors',
        isSelected && 'bg-primary/10 hover:bg-primary/10',
        isGap && node.node_type !== 'unit' && !isSelected && 'hover:bg-red-500/5'
      )}>
        {/* Expand toggle */}
        {hasChildren ? (
          <button onClick={() => setExpanded(p => !p)} className="text-muted-foreground hover:text-foreground shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}

        {/* Node label – clickable to view resources */}
        <button
          className={cn(
            'flex-1 text-sm text-left transition-colors',
            node.node_type === 'unit' ? 'font-semibold text-base' : 'font-medium',
            node.node_type !== 'unit' && 'hover:text-primary cursor-pointer',
          )}
          onClick={() => node.node_type !== 'unit' && onSelectNode?.(node)}
        >
          {node.title}
        </button>

        {/* Type badge */}
        <Badge variant="secondary" className="text-xs hidden sm:flex shrink-0 capitalize">
          {node.node_type}
        </Badge>

        {/* Resource indicator */}
        {node.node_type !== 'unit' && (
          <button
            onClick={() => onSelectNode?.(node)}
            className="flex items-center gap-1 shrink-0"
            title={`${resourceCount} resource${resourceCount !== 1 ? 's' : ''} – click to view`}
          >
            {isGap ? (
              <Badge variant="gap" className="gap-1">
                <AlertCircle className="w-3 h-3" /> No resources
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1">
                <CheckCircle className="w-3 h-3" /> {resourceCount}
              </Badge>
            )}
          </button>
        )}

        {/* Professor actions */}
        {isProfessor && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {(node.node_type === 'unit' || node.node_type === 'topic') && (
              <button
                onClick={() => onAdd(node.id, node.node_type === 'unit' ? 'topic' : 'subtopic')}
                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Add child"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onDelete(node.id, node.title)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map(child => (
            <SyllabusNodeItem
              key={child.id} node={child} isProfessor={isProfessor}
              onAdd={onAdd} onDelete={onDelete} onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId} depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Node Modal ─────────────────────────────────────────────────────────────
function AddNodeModal({ open, onClose, onSubmit, parentId, nodeType, classroomId }) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await onSubmit({ classroomId, parent_id: parentId, node_type: nodeType, title })
      setTitle('')
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add node')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {nodeType === 'unit' ? 'Unit' : nodeType === 'topic' ? 'Topic' : 'Sub-topic'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={nodeType === 'unit' ? 'e.g. Unit 1: Introduction' : 'e.g. Arrays and Linked Lists'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Gap Analysis Panel ────────────────────────────────────────────────────────
function GapAnalysisPanel({ classroomId }) {
  const { fetchGapAnalysis } = useSyllabus()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await fetchGapAnalysis(classroomId)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [classroomId])

  if (loading) return <div className="text-muted-foreground text-sm flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Analyzing…</div>
  if (!data) return null

  const { summary, gaps } = data
  const pct = summary.coverage_percent

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Gap Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Coverage</span>
            <span className={pct === 100 ? 'text-green-400' : pct > 50 ? 'text-amber-400' : 'text-red-400'}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-xl font-bold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">Total Topics</div>
          </div>
          <div className="p-2 rounded-lg bg-green-500/10">
            <div className="text-xl font-bold text-green-400">{summary.covered}</div>
            <div className="text-xs text-muted-foreground">Covered</div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10">
            <div className="text-xl font-bold text-red-400">{summary.gaps}</div>
            <div className="text-xs text-muted-foreground">Gaps</div>
          </div>
        </div>

        {gaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Topics Missing Resources</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {gaps.map(g => (
                <div key={g.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-sm truncate">{g.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { fetchClassroom, currentClassroom, fetchMembers, members } = useClassroom()
  const { fetchSyllabus, tree, nodes, addNode, deleteNode } = useSyllabus()

  const [addModal, setAddModal] = useState({ open: false, parentId: null, nodeType: 'unit' })
  const [activeTab, setActiveTab] = useState('syllabus')
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null) // node whose resources are shown

  const isProfessor = user?.role === 'professor'

  useEffect(() => {
    Promise.all([fetchClassroom(id), fetchSyllabus(id), fetchMembers(id)])
      .finally(() => setLoading(false))
  }, [id])

  const handleAddNode = (parentId, nodeType) => {
    setAddModal({ open: true, parentId, nodeType })
  }

  const handleDeleteNode = async (nodeId, title) => {
    if (!confirm(`Delete "${title}" and all its children?`)) return
    await deleteNode(nodeId)
    fetchSyllabus(id) // refresh tree
  }

  const handleAddRoot = () => setAddModal({ open: true, parentId: null, nodeType: 'unit' })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <AddNodeModal
        open={addModal.open}
        onClose={() => setAddModal(p => ({ ...p, open: false }))}
        onSubmit={({ classroomId, ...rest }) => addNode(id, rest).then(() => fetchSyllabus(id))}
        parentId={addModal.parentId}
        nodeType={addModal.nodeType}
        classroomId={id}
      />

      <div className="p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/classrooms" className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Classrooms
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{currentClassroom?.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{currentClassroom?.name}</h1>
            <p className="text-muted-foreground mt-1">Section {currentClassroom?.section} · {currentClassroom?.member_count} members</p>
            {currentClassroom?.description && (
              <p className="text-sm text-muted-foreground mt-2">{currentClassroom.description}</p>
            )}
          </div>
          {isProfessor && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Invite Code</p>
              <p className="font-mono font-bold text-primary text-lg tracking-widest">{currentClassroom?.invite_code}</p>
            </div>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/classrooms/${id}/bounties`)}>
            <Trophy className="w-4 h-4 text-amber-400" /> Bounty Board
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/classrooms/${id}/exam`)}>
            <BookOpen className="w-4 h-4 text-emerald-400" /> Exam Section
          </Button>
          {isProfessor && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/classrooms/${id}/professor`)}>
              <GraduationCap className="w-4 h-4 text-primary" /> Analytics Dashboard
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {[
            { id: 'syllabus', label: 'Syllabus Tree', icon: FileText },
            { id: 'members', label: `Members (${members.length})`, icon: Users },
            { id: 'analysis', label: 'Gap Analysis', icon: BarChart2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Syllabus Tree Tab */}
        {activeTab === 'syllabus' && (
          <div className="flex gap-6">
            {/* Tree panel */}
            <div className={cn('transition-all', selectedNode ? 'w-80 shrink-0' : 'flex-1')}>
              {isProfessor && (
                <div className="flex justify-end mb-4">
                  <Button onClick={handleAddRoot} size="sm">
                    <Plus className="w-4 h-4" /> Add Unit
                  </Button>
                </div>
              )}
              {tree.length === 0 ? (
                <Card className="glass border-border/50 border-dashed">
                  <CardContent className="pt-12 pb-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="text-lg font-semibold mb-1">No syllabus yet</h3>
                    <p className="text-sm text-muted-foreground">
                      {isProfessor ? 'Click "Add Unit" to start building the syllabus.' : 'Your professor hasn\'t added a syllabus yet.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass border-border/50">
                  <CardContent className="pt-4 pb-4 space-y-1">
                    {tree.map(node => (
                      <SyllabusNodeItem
                        key={node.id}
                        node={node}
                        isProfessor={isProfessor}
                        onAdd={handleAddNode}
                        onDelete={handleDeleteNode}
                        onSelectNode={setSelectedNode}
                        selectedNodeId={selectedNode?.id}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Resource panel (when a node is selected) */}
            {selectedNode && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <Card className="glass border-border/50 h-full">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <span className="font-semibold truncate">{selectedNode.title}</span>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="ml-auto text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-muted"
                      >
                        Close
                      </button>
                    </div>
                    <ResourceList
                      nodeId={selectedNode.id}
                      nodeTitle={selectedNode.title}
                      classroomId={id}
                      onViewResource={(resource) =>
                        navigate(`/classrooms/${id}/resources/${resource.id}/view`)
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {members.map(m => (
              <Card key={m.id} className="glass border-border/50">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {m.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <Badge variant={m.role === 'professor' ? 'default' : 'secondary'} className="capitalize shrink-0">
                    {m.role}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Gap Analysis Tab */}
        {activeTab === 'analysis' && <GapAnalysisPanel classroomId={id} />}
      </div>
    </Layout>
  )
}
