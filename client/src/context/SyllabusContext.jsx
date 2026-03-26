import { createContext, useContext, useState, useCallback } from 'react'
import api from '../utils/api'

const SyllabusContext = createContext(null)

/** Converts flat node array from API into nested tree */
function buildTree(nodes) {
  const map = {}
  const roots = []
  nodes.forEach(n => { map[n.id] = { ...n, children: [] } })
  nodes.forEach(n => {
    if (n.parent_id) {
      map[n.parent_id]?.children.push(map[n.id])
    } else {
      roots.push(map[n.id])
    }
  })
  return roots
}

export function SyllabusProvider({ children }) {
  const [syllabusId, setSyllabusId] = useState(null)
  const [flatNodes, setFlatNodes]   = useState([])
  const [tree, setTree]             = useState([])
  const [gapData, setGapData]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const fetchTree = useCallback(async (classroomId) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/api/syllabus/${classroomId}`)
      setSyllabusId(data.syllabusId)
      setFlatNodes(data.nodes)
      setTree(buildTree(data.nodes))
      return data
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load syllabus')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const addNode = useCallback(async (classroomId, { node_type, title, parent_id }) => {
    const { data } = await api.post(`/api/syllabus/${classroomId}/nodes`, {
      node_type,
      title,
      parent_id: parent_id || null,
    })
    // Refresh tree
    await fetchTree(classroomId)
    return data.node
  }, [fetchTree])

  const updateNode = useCallback(async (classroomId, nodeId, updates) => {
    const { data } = await api.put(`/api/syllabus/nodes/${nodeId}`, updates)
    await fetchTree(classroomId)
    return data.node
  }, [fetchTree])

  const deleteNode = useCallback(async (classroomId, nodeId) => {
    await api.delete(`/api/syllabus/nodes/${nodeId}`)
    await fetchTree(classroomId)
  }, [fetchTree])

  const fetchGapAnalysis = useCallback(async (classroomId) => {
    try {
      const { data } = await api.get(`/api/syllabus/${classroomId}/gap-analysis`)
      setGapData(data)
      return data
    } catch {
      return null
    }
  }, [])

  const value = {
    syllabusId,
    flatNodes,
    tree,
    gapData,
    loading,
    error,
    fetchTree,
    addNode,
    updateNode,
    deleteNode,
    fetchGapAnalysis,
  }

  return (
    <SyllabusContext.Provider value={value}>
      {children}
    </SyllabusContext.Provider>
  )
}

export function useSyllabus() {
  const ctx = useContext(SyllabusContext)
  if (!ctx) throw new Error('useSyllabus must be used within SyllabusProvider')
  return ctx
}

export default SyllabusContext
