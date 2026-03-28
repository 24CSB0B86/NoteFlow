/**
 * RBAC middleware factories
 */

/** Allow only professors */
const requireProfessor = (req, res, next) => {
  if (req.user?.role !== 'professor') {
    return res.status(403).json({ error: 'Access denied: Professors only' });
  }
  next();
};

/** Allow only students */
const requireStudent = (req, res, next) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Access denied: Students only' });
  }
  next();
};

/** Allow any authenticated user */
const requireAnyRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

module.exports = { requireProfessor, requireStudent, requireAnyRole };
