const router = require('express').Router();
const prisma = require('../db');
const alarmEngine = require('../services/alarmEngine');
const { requireRole } = require('../auth/middleware');

// GET /alarms?status=OPEN,ACKNOWLEDGED&level=L-1250
router.get('/', async (req, res) => {
  const statuses = (req.query.status || 'OPEN,ACKNOWLEDGED').split(',');
  const where = { status: { in: statuses } };
  if (req.query.level) where.level = { code: req.query.level };
  const alarms = await prisma.alarm.findMany({
    where,
    include: {
      level: { select: { code: true, name: true } },
      sensor: { select: { code: true, location: true } },
      fan: { select: { code: true } },
      ackBy: { select: { name: true } },
      clearedBy: { select: { name: true } },
    },
    orderBy: [{ openedAt: 'desc' }],
    take: 200,
  });
  res.json(alarms);
});

router.get('/:id', async (req, res) => {
  const alarm = await prisma.alarm.findUnique({
    where: { id: Number(req.params.id) },
    include: { level: true, sensor: true, fan: true, ackBy: true, clearedBy: true },
  });
  if (!alarm) return res.status(404).json({ error: 'not found' });
  const readings = alarm.sensorId
    ? await prisma.reading.findMany({
        where: { sensorId: alarm.sensorId, ts: { gte: new Date(alarm.openedAt.getTime() - 30 * 60 * 1000) } },
        orderBy: { ts: 'asc' },
      })
    : [];
  res.json({ ...alarm, readings });
});

// any signed-in control room user can acknowledge
router.post('/:id/acknowledge', requireRole('OPERATOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    res.json(await alarmEngine.acknowledge(Number(req.params.id), req.user));
  } catch (e) {
    next(e);
  }
});

// only a shift supervisor clears
router.post('/:id/clear', requireRole('SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    res.json(await alarmEngine.clear(Number(req.params.id), req.user, req.body.comment));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
