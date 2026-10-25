const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authRequired } = require('./middleware');

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: (email || '').toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'wrong email or password' });
  }
  // 12h tokens line up with a shift
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

router.get('/me', authRequired, (req, res) => res.json(req.user));

module.exports = router;
