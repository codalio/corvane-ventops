const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'not signed in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'session expired' });
  }
}

// requireRole('SUPERVISOR', 'ADMIN')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

function internalOnly(req, res, next) {
  if (req.headers['x-internal-token'] !== process.env.INTERNAL_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = { authRequired, requireRole, internalOnly };
