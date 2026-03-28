import { createContext, useContext, useState, useCallback } from 'react'
import api from '../lib/api'

const SyllabusContext = createContext(null)

export function SyllabusProvider({ children }) {
  const [syllabus, setSyllabus] = useState(null)
  const [nodes, setNodes] = useState([])
  const [tree, setTree] = useState([])
  const [gapAnalysis, setGapAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSyllabus = useCallback(async (classroomId) => {
    setLoading(true); setError(null)
    try {
      const res = await api.get(`/api/syllabus/${classroomId}`)
      setSyllabus(res.data.syllabus)
      setNodes(res.data.nodes)
      setTree(res.data.tree)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load syllabus')
    } finally { setLoading(false) }
  }, [])

  const addNode = useCallback(async (classroomId, nodeData) => {
    const res = await api.post(`/api/syllabus/${classroomId}/nodes`, nodeData)
    setNodes(prev => [...prev, res.data.node])
    return res.data.node
  }, [])

  const updateNode = useCallback(async (nodeId, data) => {
    const res = await api.put(`/api/syllabus/nodes/${nodeId}`, data)
    setNodes(prev => prev.map(n => n.id === nodeId ? res.data.node : n))
    return res.data.node
  }, [])

  const deleteNode = useCallback(async (nodeId) => {
    await api.delete(`/api/syllabus/nodes/${nodeId}`)
    setNodes(prev => prev.filter(n => n.id !== nodeId))
  }, [])

  const fetchGapAnalysis = useCallback(async (classroomId) => {
    const res = await api.get(`/api/syllabus/${classroomId}/gap-analysis`)
    setGapAnalysis(res.data)
    return res.data
  }, [])

  const initializeSyllabus = useCallback(async (classroomId) => {
    const res = await api.post(`/api/syllabus/${classroomId}`)
    setSyllabus(res.data.syllabus)
    return res.data.syllabus
  }, [])

  return (
    <SyllabusContext.Provider value={{
      syllabus, nodes, tree, gapAnalysis, loading, error,
      fetchSyllabus, addNode, updateNode, deleteNode, fetchGapAnalysis, initializeSyllabus,
    }}>
      {children}
    </SyllabusContext.Provider>
  )
}

export function useSyllabus() {
  const ctx = useContext(SyllabusContext)
  if (!ctx) throw new Error('useSyllabus must be inside SyllabusProvider')
  return ctx
}
