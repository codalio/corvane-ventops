const router = require('express').Router();
const dayjs = require('dayjs');
const prisma = require('../db');
const audit = require('../services/audit');
const { requireRole } = require('../auth/middleware');

router.get('/', async (req, res) => {
  const sensors = await prisma.sensor.findMany({
    include: { level: { select: { code: true } } },
    orderBy: [{ levelId: 'asc' }, { code: 'asc' }],
  });
  const now = dayjs();
  res.json(
    sensors.map((s) => ({
      ...s,
      calibrationDue: !s.lastCalibratedAt || now.diff(s.lastCalibratedAt, 'day') > 30,
      bumpDue: !s.lastBumpTestAt || now.diff(s.lastBumpTestAt, 'hour') > 24,
      stale: !s.lastSeenAt || now.diff(s.lastSeenAt, 'second') > 120,
    }))
  );
});

router.post('/', requireRole('ENGINEER', 'ADMIN'), async (req, res) => {
  const { code, gas, levelCode, location, mqttTopic } = req.body;
  const level = await prisma.level.findUnique({ where: { code: levelCode } });
  const sensor = await prisma.sensor.create({ data: { code, gas, levelId: level.id, location, mqttTopic } });
  await audit.log(req.user.id, 'SENSOR_CREATE', 'Sensor', sensor.code);
  res.status(201).json(sensor);
});

// take a sensor out of service (e.g. moved, damaged). Its alarms stop; a work order should exist.
router.post('/:id/deactivate', requireRole('ENGINEER', 'ADMIN'), async (req, res) => {
  const sensor = await prisma.sensor.update({ where: { id: Number(req.params.id) }, data: { active: false } });
  await audit.log(req.user.id, 'SENSOR_DEACTIVATE', 'Sensor', sensor.code, { reason: req.body.reason });
  res.json(sensor);
});

module.exports = router;
