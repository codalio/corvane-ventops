const router = require('express').Router();
const prisma = require('../db');
const levelStatus = require('../services/levelStatus');
const tagboard = require('../integrations/tagboard');
const audit = require('../services/audit');
const { requireRole } = require('../auth/middleware');

// control room overview: every level with its sensors, fans and open alarm count
router.get('/', async (req, res) => {
  const levels = await prisma.level.findMany({
    orderBy: { depthM: 'asc' },
    include: {
      sensors: { where: { active: true }, select: { id: true, code: true, gas: true, lastValue: true, lastSeenAt: true, location: true } },
      fans: { select: { code: true, type: true, status: true, airflowM3s: true, setpointHz: true } },
      _count: { select: { alarms: { where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } } } },
    },
  });
  let headcount = null;
  try {
    headcount = await tagboard.headcount();
  } catch (e) {
    // tag board down: show levels without people counts
  }
  res.json(levels.map((l) => ({ ...l, people: headcount?.byZone?.[l.code] ?? null })));
});

router.get('/:code', async (req, res) => {
  const level = await prisma.level.findUnique({
    where: { code: req.params.code },
    include: { sensors: true, fans: true, equipment: true },
  });
  if (!level) return res.status(404).json({ error: 'not found' });
  const people = await tagboard.personnelOnLevel(level.code).catch(() => []);
  res.json({ ...level, personnel: people });
});

router.get('/:code/reentry-check', requireRole('SUPERVISOR', 'ADMIN'), async (req, res) => {
  const level = await prisma.level.findUnique({ where: { code: req.params.code } });
  res.json(await levelStatus.reentryCheck(level.id));
});

router.post('/:code/reentry', requireRole('SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const level = await prisma.level.findUnique({ where: { code: req.params.code } });
    const status = await levelStatus.confirmReentry(level.id, req.user);
    await audit.log(req.user.id, 'LEVEL_REENTRY', 'Level', level.code);
    res.json({ status });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
