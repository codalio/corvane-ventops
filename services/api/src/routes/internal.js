const router = require('express').Router();
const prisma = require('../db');
const alarmEngine = require('../services/alarmEngine');
const cmms = require('../integrations/cmms');
const levelStatus = require('../services/levelStatus');
const { publish } = require('../bus');

let sensorsByTopic = null;
async function sensorFor(topic) {
  if (!sensorsByTopic) {
    const rows = await prisma.sensor.findMany({ where: { active: true } });
    sensorsByTopic = new Map(rows.map((s) => [s.mqttTopic, s]));
    setTimeout(() => (sensorsByTopic = null), 60_000);
  }
  return sensorsByTopic.get(topic);
}

// POST /internal/readings  { readings: [{ topic, value, ts }] }
router.post('/readings', async (req, res, next) => {
  try {
    const results = [];
    for (const r of req.body.readings || []) {
      const sensor = await sensorFor(r.topic);
      if (!sensor) {
        results.push({ topic: r.topic, skipped: 'unknown sensor' });
        continue;
      }
      const fresh = await prisma.sensor.findUnique({ where: { id: sensor.id } });
      const out = await alarmEngine.processReading(fresh, Number(r.value), new Date(r.ts));
      results.push({ topic: r.topic, ...out });
    }
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

// POST /internal/sensor-fault  { topic, lastSeenAt }
router.post('/sensor-fault', async (req, res, next) => {
  try {
    const sensor = await sensorFor(req.body.topic);
    if (!sensor) return res.status(404).json({ error: 'unknown sensor' });
    const open = await prisma.alarm.findFirst({
      where: { sensorId: sensor.id, type: 'SENSOR_FAULT', status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    });
    if (open) return res.json({ alarmId: open.id, existing: true });

    const workOrderId = await cmms.createWorkOrder({
      assetCode: sensor.code,
      title: `Gas sensor ${sensor.code} not reporting`,
      description: `No reading since ${req.body.lastSeenAt}. Location: ${sensor.location}.`,
      priority: sensor.gas === 'CH4' || sensor.gas === 'CO' ? 'P1' : 'P2',
    }).catch(() => null);

    const alarm = await prisma.alarm.create({
      data: {
        type: 'SENSOR_FAULT',
        severity: 'ALARM',
        levelId: sensor.levelId,
        sensorId: sensor.id,
        gas: sensor.gas,
        message: `${sensor.code} (${sensor.gas}) stopped reporting`,
        cmmsWorkOrderId: workOrderId,
      },
    });
    await publish('ventops.alarm.opened', { alarmId: alarm.id, severity: 'ALARM', type: 'SENSOR_FAULT', sensor: sensor.code });
    await levelStatus.recompute(sensor.levelId);
    res.json({ alarmId: alarm.id });
  } catch (e) {
    next(e);
  }
});

// on-call contacts the notifier escalates to
router.get('/on-call', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ['SUPERVISOR', 'ENGINEER'] }, phone: { not: null } },
    select: { name: true, role: true, phone: true, email: true },
  });
  res.json(users);
});

// is this alarm still unacknowledged? (notifier escalation)
router.get('/alarms/:id', async (req, res) => {
  const alarm = await prisma.alarm.findUnique({ where: { id: Number(req.params.id) } });
  if (!alarm) return res.status(404).json({ error: 'not found' });
  res.json({ id: alarm.id, status: alarm.status, severity: alarm.severity });
});

module.exports = router;
