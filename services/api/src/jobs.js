const dayjs = require('dayjs');
const prisma = require('./db');
const scada = require('./integrations/scada');
const tagboard = require('./integrations/tagboard');
const cmms = require('./integrations/cmms');
const vod = require('./services/ventilationOnDemand');
const levelStatus = require('./services/levelStatus');
const { publish } = require('./bus');

const DIESEL_KW = { LHD: 250, TRUCK: 375, BOLTER: 110, JUMBO: 120, LV: 0 };

let lastRecommendations = [];

async function pollFans() {
  const fans = await prisma.fan.findMany();
  for (const fan of fans) {
    try {
      const s = await scada.readFan(fan.scadaTag);
      const wasRunning = fan.status === 'RUNNING';
      await prisma.fan.update({
        where: { id: fan.id },
        data: { status: s.status, airflowM3s: s.airflowM3s, lastStatusAt: new Date(s.at || Date.now()) },
      });
      if (wasRunning && s.status !== 'RUNNING') await fanFailure(fan, s.status);
    } catch (e) {
      console.warn(`fan ${fan.code}: historian read failed`, e.message);
    }
  }
}

async function fanFailure(fan, status) {
  // a stopped main fan affects every level
  const levelIds = fan.type === 'MAIN'
    ? (await prisma.level.findMany({ select: { id: true } })).map((l) => l.id)
    : [fan.levelId];
  for (const levelId of levelIds) {
    const alarm = await prisma.alarm.create({
      data: {
        type: 'FAN_FAILURE',
        severity: fan.type === 'MAIN' ? 'EVACUATE' : 'ALARM',
        levelId,
        fanId: fan.id,
        message: `${fan.type.toLowerCase()} fan ${fan.code} ${status.toLowerCase()}`,
      },
    });
    await publish('ventops.alarm.opened', { alarmId: alarm.id, severity: alarm.severity, type: 'FAN_FAILURE', fan: fan.code });
    await levelStatus.recompute(levelId);
  }
  if (status === 'FAULT') {
    await cmms.createWorkOrder({
      assetCode: fan.code,
      title: `Fan ${fan.code} faulted`,
      description: 'Raised automatically by VentOps from SCADA run state.',
      priority: fan.type === 'MAIN' ? 'P1' : 'P2',
    }).catch((e) => console.warn('cmms work order failed', e.message));
  }
}

// keep Equipment.levelId in step with the tag board so ventilation-on-demand knows where the diesel is
async function syncEquipment() {
  try {
    const vehicles = await tagboard.vehiclesUnderground();
    const levels = await prisma.level.findMany();
    const byCode = Object.fromEntries(levels.map((l) => [l.code, l.id]));
    for (const v of vehicles) {
      await prisma.equipment.upsert({
        where: { unitId: v.unitId },
        update: { levelId: byCode[v.levelCode] ?? null },
        create: { unitId: v.unitId, kind: v.kind, dieselKw: DIESEL_KW[v.kind] ?? 0, levelId: byCode[v.levelCode] ?? null },
      });
    }
  } catch (e) {
    console.warn('tag board sync failed', e.message);
  }
}

// sensors past calibration get a work order once a day
async function calibrationDue() {
  const cutoff = dayjs().subtract(30, 'day').toDate();
  const due = await prisma.sensor.findMany({
    where: { active: true, OR: [{ lastCalibratedAt: null }, { lastCalibratedAt: { lt: cutoff } }] },
  });
  for (const s of due) {
    await cmms.createWorkOrder({
      assetCode: s.code,
      title: `Calibrate gas sensor ${s.code}`,
      description: `${s.gas} sensor at ${s.location} is past its 30-day calibration.`,
      priority: 'P3',
    }).catch(() => {});
  }
}

function start() {
  if (process.env.DISABLE_JOBS) return;
  setInterval(pollFans, 15_000);
  setInterval(syncEquipment, 30_000);
  setInterval(async () => {
    lastRecommendations = await vod.evaluateAll().catch((e) => {
      console.warn('vod failed', e.message);
      return lastRecommendations;
    });
  }, 60_000);
  setInterval(calibrationDue, 24 * 60 * 60 * 1000);
}

module.exports = { start, recommendations: () => lastRecommendations };
