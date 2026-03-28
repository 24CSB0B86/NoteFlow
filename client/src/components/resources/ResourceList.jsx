import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Upload, Search, Loader2, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ResourceCard from './ResourceCard'
import FileUploadModal from './FileUploadModal'
import VersionHistoryModal from './VersionHistoryModal'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const DOC_TYPES = ['all', 'typed', 'handwritten', 'ppt', 'image', 'video', 'other']
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'downloads', label: 'Downloads' },
]

export default function ResourceList({ nodeId, nodeTitle, classroomId, onViewResource }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState('all')
  const [sort, setSort] = useState('newest')
  const [showUpload, setShowUpload] = useState(false)
  const [versionTarget, setVersionTarget] = useState(null)

  const fetchResources = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (docType !== 'all') params.set('doc_type', docType)
      if (search) params.set('search', search)
      const { data } = await api.get(`/api/resources/node/${nodeId}?${params}`)
      setResources(data.resources || [])
    } catch (err) {
      console.error('Failed to load resources:', err.message)
    } finally { setLoading(false) }
  }, [nodeId, docType, sort, search])

  useEffect(() => { fetchResources() }, [fetchResources])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Resources {resources.length > 0 && `(${resources.length})`}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={fetchResources}
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="text-sm bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-foreground h-8"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="text-sm bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-foreground h-8"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Resource grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No resources yet</p>
          <p className="text-sm text-muted-foreground/60 mb-4">Upload notes, slides, or any study material</p>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4 mr-2" /> Upload First File
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onView={onViewResource}
              onVersionHistory={setVersionTarget}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <FileUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        nodeId={nodeId}
        nodeTitle={nodeTitle}
        classroomId={classroomId}
        onUploaded={fetchResources}
      />

      {versionTarget && (
        <VersionHistoryModal
          open={!!versionTarget}
          onClose={() => setVersionTarget(null)}
          resource={versionTarget}
          onRollback={fetchResources}
        />
      )}
    </div>
  )
}
