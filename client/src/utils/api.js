import axios from 'axios'
import { supabase } from './supabaseClient'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Supabase JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
}, (error) => Promise.reject(error))

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response } = error

    // Token expired — sign out
    if (response?.status === 401) {
      await supabase.auth.signOut()
    }

    return Promise.reject(error)
  }
)

export default api
