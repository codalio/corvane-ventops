const router = require('express').Router();
const prisma = require('../db');

// GET /readings?sensor=CH4-1250-03&from=...&to=...
router.get('/', async (req, res) => {
  const sensor = await prisma.sensor.findUnique({ where: { code: req.query.sensor } });
  if (!sensor) return res.status(404).json({ error: 'unknown sensor' });
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 6 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const rows = await prisma.reading.findMany({
    where: { sensorId: sensor.id, ts: { gte: from, lte: to } },
    orderBy: { ts: 'asc' },
    take: 5000,
  });
  res.json(rows.map((r) => ({ ts: r.ts, value: r.value, flags: r.flags })));
});

module.exports = router;
