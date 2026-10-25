const router = require('express').Router();
const prisma = require('../db');
const scada = require('../integrations/scada');
const audit = require('../services/audit');
const jobs = require('../jobs');
const { requireRole } = require('../auth/middleware');

router.get('/', async (req, res) => {
  const fans = await prisma.fan.findMany({ include: { level: { select: { code: true } } }, orderBy: { code: 'asc' } });
  res.json({ fans, recommendations: jobs.recommendations() });
});

// ventilation engineers change booster/auxiliary fan speed; main fans are changed at the fan house only
router.post('/:code/setpoint', requireRole('ENGINEER', 'ADMIN'), async (req, res, next) => {
  try {
    const fan = await prisma.fan.findUnique({ where: { code: req.params.code } });
    if (!fan) return res.status(404).json({ error: 'not found' });
    if (fan.type === 'MAIN') return res.status(400).json({ error: 'main fan setpoints are changed at the fan house' });
    const hz = Number(req.body.hz);
    if (!(hz >= 30 && hz <= fan.maxHz)) return res.status(400).json({ error: `setpoint must be 30–${fan.maxHz} Hz` });

    const result = await scada.requestSetpoint(fan.scadaTag, hz, req.user.name);
    if (result.state === 'QUEUED') {
      await prisma.fan.update({ where: { id: fan.id }, data: { setpointHz: hz } });
    }
    await audit.log(req.user.id, 'FAN_SETPOINT', 'Fan', fan.code, { from: fan.setpointHz, to: hz, scada: result.state });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
