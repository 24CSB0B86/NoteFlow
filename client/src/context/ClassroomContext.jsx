import { createContext, useContext, useState, useCallback } from 'react'
import api from '../lib/api'

const ClassroomContext = createContext(null)

export function ClassroomProvider({ children }) {
  const [classrooms, setClassrooms] = useState([])
  const [currentClassroom, setCurrentClassroom] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchMyClassrooms = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get('/api/classrooms/my-classes')
      setClassrooms(res.data.classrooms)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load classrooms')
    } finally { setLoading(false) }
  }, [])

  const fetchClassroom = useCallback(async (id) => {
    setLoading(true); setError(null)
    try {
      const res = await api.get(`/api/classrooms/${id}`)
      setCurrentClassroom(res.data.classroom)
      return res.data.classroom
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load classroom')
    } finally { setLoading(false) }
  }, [])

  const createClassroom = useCallback(async (data) => {
    const res = await api.post('/api/classrooms', data)
    setClassrooms(prev => [res.data.classroom, ...prev])
    return res.data.classroom
  }, [])

  const joinClassroom = useCallback(async (invite_code) => {
    const res = await api.post('/api/classrooms/join', { invite_code })
    setClassrooms(prev => [...prev, res.data.classroom])
    return res.data.classroom
  }, [])

  const deleteClassroom = useCallback(async (id) => {
    await api.delete(`/api/classrooms/${id}`)
    setClassrooms(prev => prev.filter(c => c.id !== id))
  }, [])

  const fetchMembers = useCallback(async (id) => {
    const res = await api.get(`/api/classrooms/${id}/members`)
    setMembers(res.data.members)
    return res.data.members
  }, [])

  return (
    <ClassroomContext.Provider value={{
      classrooms, currentClassroom, members, loading, error,
      fetchMyClassrooms, fetchClassroom, createClassroom, joinClassroom, deleteClassroom, fetchMembers,
    }}>
      {children}
    </ClassroomContext.Provider>
  )
}

export function useClassroom() {
  const ctx = useContext(ClassroomContext)
  if (!ctx) throw new Error('useClassroom must be inside ClassroomProvider')
  return ctx
}
