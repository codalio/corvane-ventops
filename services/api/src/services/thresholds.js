const prisma = require('../db');

// Fallback limits used when the thresholds table hasn't been set up for a gas.
// Ventilation engineering signs off the real values per site (PUT /thresholds/:gas).
const DEFAULTS = {
  CH4: { unit: '%vol', warn: 0.5, alarm: 1.0, evacuate: 1.5, direction: 'ABOVE' },
  CO: { unit: 'ppm', warn: 25, alarm: 50, evacuate: 200, direction: 'ABOVE' },
  NO2: { unit: 'ppm', warn: 2, alarm: 3, evacuate: 10, direction: 'ABOVE' },
  H2S: { unit: 'ppm', warn: 5, alarm: 10, evacuate: 50, direction: 'ABOVE' },
  O2: { unit: '%vol', warn: 19.5, alarm: 19.0, evacuate: 18.0, direction: 'BELOW' },
  DPM: { unit: 'mg/m3', warn: 0.1, alarm: 0.16, evacuate: null, direction: 'ABOVE' },
};

let cache = null;
let cacheAt = 0;

async function all() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const rows = await prisma.threshold.findMany();
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.gas] = r;
  cache = map;
  cacheAt = Date.now();
  return map;
}

function invalidate() {
  cache = null;
}

function beyond(value, limit, direction) {
  if (limit === null || limit === undefined) return false;
  return direction === 'BELOW' ? value <= limit : value >= limit;
}

// returns 'EVACUATE' | 'ALARM' | 'WARNING' | null
function classify(value, t) {
  if (beyond(value, t.evacuate, t.direction)) return 'EVACUATE';
  if (beyond(value, t.alarm, t.direction)) return 'ALARM';
  if (beyond(value, t.warn, t.direction)) return 'WARNING';
  return null;
}

function isBackToNormal(value, t) {
  return !beyond(value, t.warn, t.direction);
}

module.exports = { all, invalidate, classify, isBackToNormal, DEFAULTS };
