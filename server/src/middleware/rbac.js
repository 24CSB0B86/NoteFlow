/**
 * RBAC Middleware Factory
 * Usage: router.get('/route', authenticate, requireRole('professor'), handler)
 */

/**
 * Require one or more roles to access a route.
 * @param {...string} roles - Allowed roles (e.g., 'professor', 'student')
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      })
    }

    next()
  }
}

/**
 * Require professor role
 */
export const requireProfessor = requireRole('professor')

/**
 * Require student role
 */
export const requireStudent = requireRole('student')

/**
 * Allow both professors and students (just ensures authenticated)
 */
export const requireAnyRole = requireRole('professor', 'student')
