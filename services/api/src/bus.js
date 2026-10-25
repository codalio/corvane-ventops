// Redis pub/sub between api and notifier.
// Channels:
//   ventops.alarm.opened     -> notifier sends SMS/email by severity
//   ventops.level.evacuate   -> notifier fires sirens + messages everyone on the level
//   ventops.level.reentry    -> notifier tells supervisors the level can be re-entered
const Redis = require('ioredis');

const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function publish(channel, payload) {
  return pub.publish(channel, JSON.stringify({ ...payload, at: new Date().toISOString() }));
}

module.exports = { publish };
