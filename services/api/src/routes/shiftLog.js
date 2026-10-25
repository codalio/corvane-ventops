const router = require('express').Router();
const dayjs = require('dayjs');
const prisma = require('../db');

function currentShift(now = dayjs()) {
  const [dh, dm] = (process.env.SHIFT_DAY_START || '06:00').split(':').map(Number);
  const [nh, nm] = (process.env.SHIFT_NIGHT_START || '18:00').split(':').map(Number);
  const mins = now.hour() * 60 + now.minute();
  const dayStart = dh * 60 + dm;
  const nightStart = nh * 60 + nm;
  if (mins >= dayStart && mins < nightStart) return { shift: 'DAY', date: now.startOf('day') };
  // night shift belongs to the date it started on
  const date = mins < dayStart ? now.subtract(1, 'day').startOf('day') : now.startOf('day');
  return { shift: 'NIGHT', date };
}

// GET /shift-log?date=2024-11-03&shift=NIGHT
router.get('/', async (req, res) => {
  const cur = currentShift();
  const date = req.query.date ? dayjs(req.query.date) : cur.date;
  const shift = req.query.shift || cur.shift;
  const entries = await prisma.shiftLogEntry.findMany({
    where: { shiftDate: date.toDate(), shift },
    include: { author: { select: { name: true, role: true } }, level: { select: { code: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ date: date.format('YYYY-MM-DD'), shift, entries });
});

router.post('/', async (req, res) => {
  const { text, category = 'GENERAL', levelCode } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'entry text is required' });
  const cur = currentShift();
  const level = levelCode ? await prisma.level.findUnique({ where: { code: levelCode } }) : null;
  const entry = await prisma.shiftLogEntry.create({
    data: {
      shiftDate: cur.date.toDate(),
      shift: cur.shift,
      category,
      text: text.trim(),
      levelId: level?.id,
      authorId: req.user.id,
    },
  });
  res.status(201).json(entry);
});

module.exports = router;
module.exports.currentShift = currentShift;
