import { useEffect, useState } from 'react'
import { Plus, TreePine, RefreshCw } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '../ui/button'
import { useAuth } from '../../context/AuthContext'
import { useSyllabus } from '../../context/SyllabusContext'
import SyllabusNode from './SyllabusNode'
import AddNodeModal from './AddNodeModal'

function SortableNodeWrapper({ node, classroomId, onAddChild, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <SyllabusNode
        node={node}
        classroomId={classroomId}
        depth={0}
        dragListeners={listeners}
        dragAttributes={attributes}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

export default function SyllabusTree({ classroomId }) {
  const { isProfessor } = useAuth()
  const { tree, loading, error, fetchTree, updateNode, deleteNode } = useSyllabus()
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', node? }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (classroomId) fetchTree(classroomId)
  }, [classroomId, fetchTree])

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    // Reorder: update order_index for dragged node
    const allFlat = flattenTree(tree)
    const overIdx = allFlat.findIndex(n => n.id === over.id)
    await updateNode(classroomId, active.id, { order_index: overIdx })
  }

  function flattenTree(nodes, result = []) {
    nodes.forEach(n => { result.push(n); if (n.children) flattenTree(n.children, result) })
    return result
  }

  const handleDelete = async (node) => {
    if (!confirm(`Delete "${node.title}" and all its children?`)) return
    await deleteNode(classroomId, node.id)
  }

  const handleEdit = (node) => setModal({ mode: 'edit', node })
  const handleAddChild = (node) => setModal({ mode: 'add', node: { ...node, _isAddChild: true } })
  const handleAddRoot = () => setModal({ mode: 'add', node: null })

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading syllabus…
    </div>
  )

  if (error) return (
    <div className="text-red-400 text-sm py-8 text-center">{error}</div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <TreePine className="h-4 w-4" />
          <span>{flattenTree(tree).length} nodes</span>
        </div>
        {isProfessor && (
          <Button onClick={handleAddRoot} size="sm"
            className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Unit
          </Button>
        )}
      </div>

      {/* Tree */}
      {tree.length === 0 ? (
        <div className="text-center py-16">
          <TreePine className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">No syllabus yet</p>
          {isProfessor && (
            <Button onClick={handleAddRoot} variant="outline" size="sm"
              className="border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600/20">
              <Plus className="h-4 w-4 mr-1.5" /> Create First Unit
            </Button>
          )}
          {!isProfessor && <p className="text-xs text-slate-600">Your professor hasn't added a syllabus yet.</p>}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tree.map(n => n.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {tree
                .sort((a, b) => a.order_index - b.order_index)
                .map(node => (
                  <SortableNodeWrapper
                    key={node.id}
                    node={node}
                    classroomId={classroomId}
                    onAddChild={handleAddChild}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modal */}
      {modal && (
        <AddNodeModal
          classroomId={classroomId}
          parentNode={modal.mode === 'add' ? modal.node : modal.node}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
