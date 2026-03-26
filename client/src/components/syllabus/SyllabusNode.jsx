import { useState } from 'react'
import { ChevronRight, ChevronDown, CircleDot, Minus, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Button } from '../ui/button'
import { useAuth } from '../../context/AuthContext'
import { useSyllabus } from '../../context/SyllabusContext'

const NODE_COLORS = {
  unit:     'text-violet-400 border-violet-500/30 bg-violet-600/10',
  topic:    'text-indigo-400 border-indigo-500/30 bg-indigo-600/10',
  subtopic: 'text-cyan-400 border-cyan-500/30 bg-cyan-600/10',
}

const DEPTH_PADDING = { 0: 'pl-0', 1: 'pl-6', 2: 'pl-12' }

function ResourceBadge({ count }) {
  if (count > 0) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
        {count}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-600/20 border border-red-500/30 text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
      0
    </span>
  )
}

export default function SyllabusNode({
  node,
  classroomId,
  depth = 0,
  dragListeners,
  dragAttributes,
  onAddChild,
  onEdit,
  onDelete,
}) {
  const { isProfessor } = useAuth()
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children?.length > 0
  const colorClass = NODE_COLORS[node.node_type] || NODE_COLORS.topic

  return (
    <div className={DEPTH_PADDING[Math.min(depth, 2)]}>
      <div className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/50 transition-colors">
        {/* Drag handle (professor only) */}
        {isProfessor && (
          <div
            {...dragListeners}
            {...dragAttributes}
            className="cursor-grab text-slate-700 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(p => !p)}
          className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
          disabled={!hasChildren}
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)
            : <Minus className="h-4 w-4 opacity-30" />
          }
        </button>

        {/* Node type badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${colorClass}`}>
          {node.node_type}
        </span>

        {/* Title */}
        <span className="flex-1 text-sm text-slate-200 truncate">{node.title}</span>

        {/* Resource badge */}
        <ResourceBadge count={node.resource_count ?? 0} />

        {/* Professor actions */}
        {isProfessor && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.node_type !== 'subtopic' && (
              <Button size="icon" variant="ghost"
                onClick={() => onAddChild(node)}
                className="h-6 w-6 text-slate-500 hover:text-indigo-400 hover:bg-indigo-600/10"
                title="Add child node"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button size="icon" variant="ghost"
              onClick={() => onEdit(node)}
              className="h-6 w-6 text-slate-500 hover:text-amber-400 hover:bg-amber-600/10"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost"
              onClick={() => onDelete(node)}
              className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-600/10"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-0.5 border-l border-slate-800 ml-4 pl-2">
          {node.children
            .sort((a, b) => a.order_index - b.order_index)
            .map(child => (
              <SyllabusNode
                key={child.id}
                node={child}
                classroomId={classroomId}
                depth={depth + 1}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
        </div>
      )}
    </div>
  )
}
