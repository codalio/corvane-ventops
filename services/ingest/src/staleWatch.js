// A gas sensor that stops reporting is treated as a fault: you can't trust air
// you can't measure. Sensors report every 10 seconds.
const STALE_AFTER_MS = 120 * 1000;
const CHECK_EVERY_MS = 15 * 1000;

const lastSeen = new Map(); // topic -> Date
const reported = new Set();

function seen(topic, ts) {
  lastSeen.set(topic, new Date(ts));
  reported.delete(topic);
}

function start(onStale) {
  setInterval(() => {
    const now = Date.now();
    for (const [topic, at] of lastSeen) {
      if (now - at.getTime() > STALE_AFTER_MS && !reported.has(topic)) {
        reported.add(topic);
        onStale(topic, at.toISOString());
      }
    }
  }, CHECK_EVERY_MS);
}

module.exports = { seen, start };
