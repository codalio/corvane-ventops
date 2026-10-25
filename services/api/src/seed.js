// Seeds the North Shaft levels, sensors, fans and the first users.
const bcrypt = require('bcryptjs');
const prisma = require('./db');
const { DEFAULTS } = require('./services/thresholds');

const LEVELS = [
  { code: 'L-850', name: '850 Level - Haulage', depthM: 850, minAirflowM3s: 35 },
  { code: 'L-1050', name: '1050 Level - Stoping', depthM: 1050, minAirflowM3s: 25 },
  { code: 'L-1250', name: '1250 Level - Development', depthM: 1250, minAirflowM3s: 20 },
  { code: 'L-1450', name: '1450 Level - Ramp & Refuge', depthM: 1450, minAirflowM3s: 15 },
];

const SENSOR_SET = [
  ['CH4', 'Return airway'],
  ['CH4', 'Face, heading 3'],
  ['CO', 'Return airway'],
  ['CO', 'Refuge station'],
  ['NO2', 'Return airway'],
  ['O2', 'Refuge station'],
  ['DPM', 'Main drift'],
];

async function main() {
  for (const [gas, t] of Object.entries(DEFAULTS)) {
    await prisma.threshold.upsert({ where: { gas }, update: {}, create: { gas, ...t } });
  }

  await prisma.fan.upsert({
    where: { code: 'MF-01' },
    update: {},
    create: { code: 'MF-01', type: 'MAIN', scadaTag: '\\\\CORVANE-SCADA\\Vent\\MF-01', maxHz: 60 },
  });

  for (const l of LEVELS) {
    const level = await prisma.level.upsert({ where: { code: l.code }, update: {}, create: l });
    const depth = l.code.slice(2);
    let i = 1;
    for (const [gas, location] of SENSOR_SET) {
      const code = `${gas}-${depth}-${String(i).padStart(2, '0')}`;
      await prisma.sensor.upsert({
        where: { code },
        update: {},
        create: { code, gas, levelId: level.id, location, mqttTopic: `corvane/north/${l.code}/${gas.toLowerCase()}/${i}` },
      });
      i++;
    }
    for (const suffix of ['A', 'B']) {
      const code = `BF-${depth}-${suffix}`;
      await prisma.fan.upsert({
        where: { code },
        update: {},
        create: { code, type: 'BOOSTER', levelId: level.id, scadaTag: `\\\\CORVANE-SCADA\\Vent\\${code}` },
      });
    }
  }

  const users = [
    ['Control Room', 'control@corvane.example', 'OPERATOR'],
    ['Shift Supervisor', 'supervisor@corvane.example', 'SUPERVISOR'],
    ['Ventilation Engineer', 'vent.eng@corvane.example', 'ENGINEER'],
    ['Site Admin', 'admin@corvane.example', 'ADMIN'],
  ];
  for (const [name, email, role] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, role, passwordHash: await bcrypt.hash('changeme', 10) },
    });
  }
  console.log('seeded');
}

main().finally(() => prisma.$disconnect());
