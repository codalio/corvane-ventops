const dayjs = require('dayjs');
const prisma = require('../db');
const thresholds = require('./thresholds');
const levelStatus = require('./levelStatus');
const audit = require('./audit');
const { publish } = require('../bus');
const tagboard = require('../integrations/tagboard');

const SEVERITY_RANK = { WARNING: 1, ALARM: 2, EVACUATE: 3 };

function readingFlags(sensor, ts) {
  const flags = [];
  if (!sensor.lastCalibratedAt || dayjs(ts).diff(sensor.lastCalibratedAt, 'day') > 30) {
    flags.push('UNCALIBRATED');
  }
  if (!sensor.lastBumpTestAt || dayjs(ts).diff(sensor.lastBumpTestAt, 'hour') > 24) {
    flags.push('BUMP_OVERDUE');
  }
  return flags;
}

/**
 * Called for every reading the ingest worker posts.
 * - stores the reading
 * - opens or escalates a GAS alarm when a limit is crossed
 * - puts the level into EVACUATE when the evacuate limit is crossed
 */
async function processReading(sensor, value, ts) {
  const flags = readingFlags(sensor, ts);
  await prisma.reading.create({
    data: { sensorId: sensor.id, value, ts, flags: flags.join(',') || null },
  });
  await prisma.sensor.update({
    where: { id: sensor.id },
    data: { lastValue: value, lastSeenAt: ts },
  });

  const limits = (await thresholds.all())[sensor.gas];
  const severity = thresholds.classify(value, limits);

  if (severity === 'ALARM' || severity === 'EVACUATE') {
    await openOrEscalate(sensor, value, severity, limits);
  }

  await levelStatus.recompute(sensor.levelId);
  return { severity, flags };
}

async function openOrEscalate(sensor, value, severity, limits) {
  const existing = await prisma.alarm.findFirst({
    where: { sensorId: sensor.id, type: 'GAS', status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
  });

  const worse = (a, b) => (limits.direction === 'BELOW' ? Math.min(a, b) : Math.max(a, b));

  if (existing) {
    const escalated = SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity];
    await prisma.alarm.update({
      where: { id: existing.id },
      data: {
        peakValue: worse(existing.peakValue ?? value, value),
        severity: escalated ? severity : existing.severity,
        // an escalation needs a fresh acknowledgement
        ...(escalated ? { status: 'OPEN', ackById: null, ackAt: null } : {}),
      },
    });
    if (escalated) await announce(existing.id, sensor, value, severity, limits);
    return existing.id;
  }

  const alarm = await prisma.alarm.create({
    data: {
      type: 'GAS',
      severity,
      levelId: sensor.levelId,
      sensorId: sensor.id,
      gas: sensor.gas,
      peakValue: value,
      message: `${sensor.gas} ${value}${limits.unit} at ${sensor.location} (${sensor.code})`,
    },
  });
  await announce(alarm.id, sensor, value, severity, limits);
  return alarm.id;
}

async function announce(alarmId, sensor, value, severity, limits) {
  const level = await prisma.level.findUnique({ where: { id: sensor.levelId } });
  await publish('ventops.alarm.opened', {
    alarmId,
    severity,
    level: level.code,
    gas: sensor.gas,
    value,
    unit: limits.unit,
    location: sensor.location,
  });

  if (severity === 'EVACUATE') {
    await prisma.level.update({
      where: { id: level.id },
      data: { status: 'EVACUATE', statusAt: new Date() },
    });
    // who is on the level right now, from the tag board
    const people = await tagboard.personnelOnLevel(level.code).catch(() => []);
    await publish('ventops.level.evacuate', {
      level: level.code,
      levelName: level.name,
      reason: `${sensor.gas} ${value}${limits.unit} at ${sensor.location}`,
      personnel: people,
    });
  }
}

async function acknowledge(alarmId, user) {
  const alarm = await prisma.alarm.findUnique({ where: { id: alarmId } });
  if (!alarm) throw httpError(404, 'alarm not found');
  if (alarm.status !== 'OPEN') throw httpError(409, `alarm is already ${alarm.status.toLowerCase()}`);
  const updated = await prisma.alarm.update({
    where: { id: alarmId },
    data: { status: 'ACKNOWLEDGED', ackById: user.id, ackAt: new Date() },
  });
  await audit.log(user.id, 'ALARM_ACK', 'Alarm', alarmId);
  return updated;
}

/**
 * Only a shift supervisor (or admin) may clear an alarm — enforced on the route
 * and again here. A gas alarm can only be cleared once the sensor is back below
 * its warning limit, and the supervisor has to say why.
 */
async function clear(alarmId, user, comment) {
  if (!['SUPERVISOR', 'ADMIN'].includes(user.role)) {
    throw httpError(403, 'only a shift supervisor can clear an alarm');
  }
  if (!comment || comment.trim().length < 5) {
    throw httpError(400, 'a clear comment is required');
  }
  const alarm = await prisma.alarm.findUnique({ where: { id: alarmId }, include: { sensor: true } });
  if (!alarm) throw httpError(404, 'alarm not found');
  if (alarm.status === 'CLEARED') throw httpError(409, 'alarm already cleared');

  if (alarm.type === 'GAS') {
    const limits = (await thresholds.all())[alarm.gas];
    const current = alarm.sensor?.lastValue;
    if (current === null || current === undefined || !thresholds.isBackToNormal(current, limits)) {
      throw httpError(409, `${alarm.gas} is still at ${current}${limits.unit}; it must be below ${limits.warn}${limits.unit} to clear`);
    }
  }

  const updated = await prisma.alarm.update({
    where: { id: alarmId },
    data: {
      status: 'CLEARED',
      clearedById: user.id,
      clearedAt: new Date(),
      clearComment: comment.trim(),
      // clearing implies acknowledgement
      ackById: alarm.ackById ?? user.id,
      ackAt: alarm.ackAt ?? new Date(),
    },
  });
  await audit.log(user.id, 'ALARM_CLEAR', 'Alarm', alarmId, { comment });
  await levelStatus.recompute(alarm.levelId);
  return updated;
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = { processReading, acknowledge, clear, readingFlags };
