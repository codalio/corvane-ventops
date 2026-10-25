const dayjs = require('dayjs');
const prisma = require('../db');
const thresholds = require('./thresholds');
const { publish } = require('../bus');

const REENTRY_CLEAN_MINUTES = 10;

/**
 * Level status is derived from open alarms and current readings.
 * EVACUATE is sticky: once a level is evacuated it only leaves that state when
 * a supervisor confirms re-entry (see confirmReentry).
 */
async function recompute(levelId) {
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    include: {
      sensors: { where: { active: true } },
      alarms: { where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } },
    },
  });
  if (!level) return null;

  if (level.status === 'EVACUATE') {
    const evacOpen = level.alarms.some((a) => a.severity === 'EVACUATE');
    if (!evacOpen) {
      await set(level.id, 'REENTRY_PENDING');
      await publish('ventops.level.reentry', { level: level.code, levelName: level.name, state: 'PENDING' });
      return 'REENTRY_PENDING';
    }
    return 'EVACUATE';
  }
  if (level.status === 'REENTRY_PENDING') return 'REENTRY_PENDING';

  let next = 'NORMAL';
  if (level.alarms.length > 0) {
    next = 'ALARM';
  } else {
    const limits = await thresholds.all();
    const anyWarning = level.sensors.some(
      (s) => s.lastValue !== null && thresholds.classify(s.lastValue, limits[s.gas]) === 'WARNING'
    );
    if (anyWarning) next = 'WARNING';
  }

  if (next !== level.status) await set(level.id, next);
  return next;
}

async function set(levelId, status) {
  await prisma.level.update({ where: { id: levelId }, data: { status, statusAt: new Date() } });
}

/**
 * Re-entry after an evacuation: every gas sensor on the level must have stayed
 * below its warning limit for the last 10 minutes, and no fan on the level may be
 * stopped or faulted.
 */
async function reentryCheck(levelId) {
  const since = dayjs().subtract(REENTRY_CLEAN_MINUTES, 'minute').toDate();
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    include: { sensors: { where: { active: true } }, fans: true },
  });
  const limits = await thresholds.all();
  const problems = [];

  for (const s of level.sensors) {
    const readings = await prisma.reading.findMany({ where: { sensorId: s.id, ts: { gte: since } } });
    if (readings.length === 0) problems.push(`${s.code}: no readings in the last ${REENTRY_CLEAN_MINUTES} min`);
    const bad = readings.find((r) => !thresholds.isBackToNormal(r.value, limits[s.gas]));
    if (bad) problems.push(`${s.code}: ${bad.value}${limits[s.gas].unit} at ${dayjs(bad.ts).format('HH:mm')}`);
  }
  for (const f of level.fans) {
    if (f.status !== 'RUNNING') problems.push(`fan ${f.code} is ${f.status.toLowerCase()}`);
  }
  return { ok: problems.length === 0, problems };
}

async function confirmReentry(levelId, user) {
  const level = await prisma.level.findUnique({ where: { id: levelId } });
  if (level.status !== 'REENTRY_PENDING') {
    const e = new Error(`level is ${level.status}, not awaiting re-entry`);
    e.status = 409;
    throw e;
  }
  const check = await reentryCheck(levelId);
  if (!check.ok) {
    const e = new Error(`re-entry blocked: ${check.problems.join('; ')}`);
    e.status = 409;
    throw e;
  }
  await set(levelId, 'NORMAL');
  await publish('ventops.level.reentry', { level: level.code, levelName: level.name, state: 'CONFIRMED', by: user.name });
  return recompute(levelId);
}

module.exports = { recompute, reentryCheck, confirmReentry };
