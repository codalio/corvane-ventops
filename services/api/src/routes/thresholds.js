const router = require('express').Router();
const prisma = require('../db');
const thresholds = require('../services/thresholds');
const audit = require('../services/audit');
const { requireRole } = require('../auth/middleware');

router.get('/', async (req, res) => {
  res.json(await thresholds.all());
});

// only ventilation engineering changes gas limits; every change is audited
router.put('/:gas', requireRole('ENGINEER', 'ADMIN'), async (req, res) => {
  const gas = req.params.gas.toUpperCase();
  const { warn, alarm, evacuate, unit, direction } = req.body;
  const before = (await thresholds.all())[gas];
  const dir = direction || before?.direction || 'ABOVE';
  const ordered = dir === 'ABOVE' ? warn < alarm && (evacuate == null || alarm < evacuate) : warn > alarm && (evacuate == null || alarm > evacuate);
  if (!ordered) return res.status(400).json({ error: 'limits must go warn → alarm → evacuate' });

  const row = await prisma.threshold.upsert({
    where: { gas },
    update: { warn, alarm, evacuate, unit: unit || before.unit, direction: dir, updatedBy: req.user.id },
    create: { gas, warn, alarm, evacuate, unit: unit || before.unit, direction: dir, updatedBy: req.user.id },
  });
  thresholds.invalidate();
  await audit.log(req.user.id, 'THRESHOLD_CHANGE', 'Threshold', gas, { before, after: row });
  res.json(row);
});

module.exports = router;
