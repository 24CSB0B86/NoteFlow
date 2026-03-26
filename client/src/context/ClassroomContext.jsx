import { createContext, useContext, useState, useCallback } from 'react'
import api from '../utils/api'

const ClassroomContext = createContext(null)

export function ClassroomProvider({ children }) {
  const [classrooms, setClassrooms]           = useState([])
  const [currentClassroom, setCurrentClassroom] = useState(null)
  const [members, setMembers]                 = useState([])
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState(null)

  const fetchMyClassrooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/classrooms/my')
      setClassrooms(data.classrooms)
      return data.classrooms
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load classrooms')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClassroom = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/api/classrooms/${id}`)
      setCurrentClassroom(data.classroom)
      return data.classroom
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load classroom')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createClassroom = useCallback(async ({ name, section, description }) => {
    const { data } = await api.post('/api/classrooms', { name, section, description })
    setClassrooms(prev => [data.classroom, ...prev])
    return data.classroom
  }, [])

  const joinClassroom = useCallback(async (inviteCode) => {
    const { data } = await api.post('/api/classrooms/join', { invite_code: inviteCode })
    setClassrooms(prev => {
      const exists = prev.find(c => c.id === data.classroom.id)
      return exists ? prev : [data.classroom, ...prev]
    })
    return data.classroom
  }, [])

  const deleteClassroom = useCallback(async (id) => {
    await api.delete(`/api/classrooms/${id}`)
    setClassrooms(prev => prev.filter(c => c.id !== id))
    if (currentClassroom?.id === id) setCurrentClassroom(null)
  }, [currentClassroom])

  const fetchMembers = useCallback(async (classroomId) => {
    try {
      const { data } = await api.get(`/api/classrooms/${classroomId}/members`)
      setMembers(data.members)
      return data.members
    } catch {
      return []
    }
  }, [])

  const value = {
    classrooms,
    currentClassroom,
    members,
    loading,
    error,
    fetchMyClassrooms,
    fetchClassroom,
    createClassroom,
    joinClassroom,
    deleteClassroom,
    fetchMembers,
    setCurrentClassroom,
  }

  return (
    <ClassroomContext.Provider value={value}>
      {children}
    </ClassroomContext.Provider>
  )
}

export function useClassroom() {
  const ctx = useContext(ClassroomContext)
  if (!ctx) throw new Error('useClassroom must be used within ClassroomProvider')
  return ctx
}

export default ClassroomContext
