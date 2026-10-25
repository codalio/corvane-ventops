const router = require('express').Router();
const dayjs = require('dayjs');
const { Parser } = require('json2csv');
const prisma = require('../db');
const thresholds = require('../services/thresholds');
const { requireRole } = require('../auth/middleware');

/**
 * Daily gas summary per sensor: min / max / average and minutes spent above the
 * warning and alarm limits. Used by ventilation engineering for the monthly review.
 * GET /reports/gas-daily?date=2024-11-03&format=csv
 */
router.get('/gas-daily', requireRole('SUPERVISOR', 'ENGINEER', 'ADMIN'), async (req, res) => {
  const day = dayjs(req.query.date || undefined).startOf('day');
  const limits = await thresholds.all();
  const sensors = await prisma.sensor.findMany({ include: { level: true } });
  const rows = [];

  for (const s of sensors) {
    const readings = await prisma.reading.findMany({
      where: { sensorId: s.id, ts: { gte: day.toDate(), lt: day.add(1, 'day').toDate() } },
      orderBy: { ts: 'asc' },
    });
    if (readings.length === 0) continue;
    const t = limits[s.gas];
    const values = readings.map((r) => r.value);
    let warnMin = 0;
    let alarmMin = 0;
    // readings arrive every 10s; count each as 1/6 minute
    for (const v of values) {
      const c = thresholds.classify(v, t);
      if (c) warnMin += 1 / 6;
      if (c === 'ALARM' || c === 'EVACUATE') alarmMin += 1 / 6;
    }
    rows.push({
      level: s.level.code,
      sensor: s.code,
      gas: s.gas,
      unit: t.unit,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
      minutesAboveWarn: Math.round(warnMin),
      minutesAboveAlarm: Math.round(alarmMin),
      uncalibratedReadings: readings.filter((r) => (r.flags || '').includes('UNCALIBRATED')).length,
    });
  }

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gas-daily-${day.format('YYYY-MM-DD')}.csv"`);
    return res.send(new Parser().parse(rows));
  }
  res.json({ date: day.format('YYYY-MM-DD'), rows });
});

// alarm history for incident review
router.get('/alarms', requireRole('SUPERVISOR', 'ENGINEER', 'ADMIN'), async (req, res) => {
  const from = dayjs(req.query.from || dayjs().subtract(7, 'day')).toDate();
  const alarms = await prisma.alarm.findMany({
    where: { openedAt: { gte: from } },
    include: { level: true, sensor: true, ackBy: true, clearedBy: true },
    orderBy: { openedAt: 'desc' },
  });
  res.json(
    alarms.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      level: a.level.code,
      sensor: a.sensor?.code,
      peak: a.peakValue,
      openedAt: a.openedAt,
      minutesToAck: a.ackAt ? Math.round((a.ackAt - a.openedAt) / 60000) : null,
      clearedBy: a.clearedBy?.name,
      clearComment: a.clearComment,
    }))
  );
});

module.exports = router;
