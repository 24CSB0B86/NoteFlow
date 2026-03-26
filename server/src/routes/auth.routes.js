import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  syncUserProfile,
  getMe,
  updateMe,
  logout,
} from '../controllers/auth.controller.js'

const router = Router()

// POST /api/auth/signup
// Public — syncs user profile to Neon DB after Supabase signup
router.post('/signup', syncUserProfile)

// GET /api/auth/me
// Protected — returns current user's profile
router.get('/me', authenticate, getMe)

// PUT /api/auth/me
// Protected — update profile fields
router.put('/me', authenticate, updateMe)

// POST /api/auth/logout
// Protected — server-side sign out
router.post('/logout', authenticate, logout)

export default router
