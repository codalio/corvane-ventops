const router = require('express').Router();
const prisma = require('../db');
const audit = require('../services/audit');
const { requireRole } = require('../auth/middleware');

// a reading within 10% of the test gas passes a bump test
const BUMP_TOLERANCE = 0.1;

router.get('/', async (req, res) => {
  const where = req.query.sensor ? { sensor: { code: req.query.sensor } } : {};
  const rows = await prisma.calibration.findMany({
    where,
    include: { sensor: { select: { code: true, gas: true } }, performedBy: { select: { name: true } } },
    orderBy: { performedAt: 'desc' },
    take: 200,
  });
  res.json(rows);
});

// POST /calibrations { sensorCode, type: BUMP|FULL, testGasValue, readValue, notes }
router.post('/', requireRole('ENGINEER', 'SUPERVISOR', 'ADMIN'), async (req, res) => {
  const { sensorCode, type, testGasValue, readValue, notes } = req.body;
  const sensor = await prisma.sensor.findUnique({ where: { code: sensorCode } });
  if (!sensor) return res.status(404).json({ error: 'unknown sensor' });
  if (type === 'FULL' && req.user.role === 'SUPERVISOR') {
    return res.status(403).json({ error: 'full calibrations are done by ventilation engineering' });
  }

  let passed = true;
  if (testGasValue && readValue !== undefined) {
    passed = Math.abs(readValue - testGasValue) / testGasValue <= BUMP_TOLERANCE;
  }

  const cal = await prisma.calibration.create({
    data: { sensorId: sensor.id, type, passed, testGasValue, readValue, notes, performedById: req.user.id },
  });
  if (passed) {
    await prisma.sensor.update({
      where: { id: sensor.id },
      data: type === 'FULL' ? { lastCalibratedAt: cal.performedAt, lastBumpTestAt: cal.performedAt } : { lastBumpTestAt: cal.performedAt },
    });
  }
  await audit.log(req.user.id, `CALIBRATION_${type}`, 'Sensor', sensor.code, { passed });
  res.status(201).json(cal);
});

module.exports = router;
