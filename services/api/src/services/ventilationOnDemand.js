const prisma = require('../db');
const { publish } = require('../bus');

// Airflow needed per kW of diesel equipment working on a level (site standard).
const M3S_PER_DIESEL_KW = 0.06;
// how long airflow can sit under the requirement before we raise an alarm
const LOW_AIRFLOW_GRACE_MS = 5 * 60 * 1000;

const lowSince = new Map(); // levelId -> timestamp

function requiredAirflow(level, equipment) {
  const dieselKw = equipment.reduce((sum, e) => sum + (e.dieselKw || 0), 0);
  return Math.max(level.minAirflowM3s, dieselKw * M3S_PER_DIESEL_KW);
}

function suggestSetpoint(fan, required, current) {
  if (!current || current <= 0) return fan.maxHz;
  // fan laws: airflow scales roughly with speed
  const hz = fan.setpointHz * (required / current);
  return Math.min(fan.maxHz, Math.max(30, Math.round(hz * 10) / 10));
}

/**
 * Runs every minute. Compares the airflow each level needs (people + diesel on it,
 * from the tag board) with what the booster/auxiliary fans deliver (from SCADA).
 * Produces recommendations for the ventilation engineer; raises AIRFLOW_LOW after
 * the grace period.
 */
async function evaluateAll() {
  const levels = await prisma.level.findMany({ include: { equipment: true, fans: true } });
  const recommendations = [];

  for (const level of levels) {
    const required = requiredAirflow(level, level.equipment);
    const delivering = level.fans
      .filter((f) => f.status === 'RUNNING' && f.type !== 'MAIN')
      .reduce((sum, f) => sum + (f.airflowM3s || 0), 0);

    if (delivering < required) {
      if (!lowSince.has(level.id)) lowSince.set(level.id, Date.now());
      for (const fan of level.fans.filter((f) => f.type !== 'MAIN')) {
        recommendations.push({
          level: level.code,
          fan: fan.code,
          requiredM3s: Math.round(required * 10) / 10,
          deliveringM3s: Math.round(delivering * 10) / 10,
          suggestedHz: suggestSetpoint(fan, required, delivering),
        });
      }
      if (Date.now() - lowSince.get(level.id) > LOW_AIRFLOW_GRACE_MS) {
        await raiseLowAirflow(level, required, delivering);
      }
    } else {
      lowSince.delete(level.id);
    }
  }
  return recommendations;
}

async function raiseLowAirflow(level, required, delivering) {
  const open = await prisma.alarm.findFirst({
    where: { levelId: level.id, type: 'AIRFLOW_LOW', status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
  });
  if (open) return;
  const alarm = await prisma.alarm.create({
    data: {
      type: 'AIRFLOW_LOW',
      severity: 'ALARM',
      levelId: level.id,
      message: `${level.code} airflow ${delivering.toFixed(1)} m3/s, needs ${required.toFixed(1)} m3/s`,
    },
  });
  await publish('ventops.alarm.opened', { alarmId: alarm.id, severity: 'ALARM', level: level.code, type: 'AIRFLOW_LOW' });
}

module.exports = { evaluateAll, requiredAirflow, suggestSetpoint };
