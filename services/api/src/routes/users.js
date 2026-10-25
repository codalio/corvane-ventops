const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const audit = require('../services/audit');
const { requireRole } = require('../auth/middleware');

router.get('/', requireRole('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { name, email, role, phone, password } = req.body;
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), role, phone, passwordHash: await bcrypt.hash(password, 10) },
  });
  await audit.log(req.user.id, 'USER_CREATE', 'User', user.id, { role });
  res.status(201).json({ id: user.id, name: user.name, role: user.role });
});

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const { role, active, phone } = req.body;
  const user = await prisma.user.update({ where: { id: Number(req.params.id) }, data: { role, active, phone } });
  await audit.log(req.user.id, 'USER_UPDATE', 'User', user.id, { role, active });
  res.json({ id: user.id, name: user.name, role: user.role, active: user.active });
});

module.exports = router;
