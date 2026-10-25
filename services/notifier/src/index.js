// Listens to alarm and level events from the API and gets them to people:
// SMS + email to on-call supervisors and engineers, sirens and SMS to everyone on an
// evacuated level, and an escalation if an alarm sits unacknowledged.
const Redis = require('ioredis');
const axios = require('axios');
const sms = require('./channels/sms');
const email = require('./channels/email');
const siren = require('./channels/siren');

const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const api = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:4000',
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

// unacknowledged ALARM escalates to the engineer on call after 5 min, EVACUATE after 2
const ESCALATE_AFTER_MS = { ALARM: 5 * 60 * 1000, EVACUATE: 2 * 60 * 1000 };

async function onCall(role) {
  const { data } = await api.get('/internal/on-call');
  return role ? data.filter((u) => u.role === role) : data;
}

async function alarmOpened(evt) {
  const text = evt.type && evt.type !== 'GAS'
    ? `VentOps ${evt.severity}: ${evt.type.replace('_', ' ').toLowerCase()} ${evt.fan || evt.sensor || ''} ${evt.level || ''}`.trim()
    : `VentOps ${evt.severity}: ${evt.gas} ${evt.value}${evt.unit} on ${evt.level} (${evt.location})`;

  const supervisors = await onCall('SUPERVISOR');
  await Promise.all(supervisors.map((u) => sms.send(u.phone, text)));
  await email.send(supervisors.map((u) => u.email), text, text);

  const wait = ESCALATE_AFTER_MS[evt.severity];
  if (wait) setTimeout(() => escalate(evt, text), wait);
}

async function escalate(evt, text) {
  const { data } = await api.get(`/internal/alarms/${evt.alarmId}`);
  if (data.status !== 'OPEN') return;
  const engineers = await onCall('ENGINEER');
  await Promise.all(engineers.map((u) => sms.send(u.phone, `UNACKNOWLEDGED - ${text}`)));
}

async function levelEvacuate(evt) {
  await siren.activate(evt.level, 'EVACUATE');
  const msg = `EVACUATE ${evt.levelName} NOW via your nearest escapeway or refuge station. Reason: ${evt.reason}`;
  await Promise.all((evt.personnel || []).filter((p) => p.phone).map((p) => sms.send(p.phone, msg)));
  const all = await onCall();
  await email.send(all.map((u) => u.email), `EVACUATION ${evt.level}`, `${msg}\n\nOn level at alarm time: ${(evt.personnel || []).length} people.`);
}

async function levelReentry(evt) {
  const supervisors = await onCall('SUPERVISOR');
  const text = evt.state === 'PENDING'
    ? `${evt.levelName}: gas back under limits. Re-entry needs a supervisor check in VentOps.`
    : `${evt.levelName}: re-entry confirmed by ${evt.by}.`;
  if (evt.state === 'CONFIRMED') await siren.activate(evt.level, 'OFF');
  await Promise.all(supervisors.map((u) => sms.send(u.phone, text)));
}

const handlers = {
  'ventops.alarm.opened': alarmOpened,
  'ventops.level.evacuate': levelEvacuate,
  'ventops.level.reentry': levelReentry,
};

sub.subscribe(...Object.keys(handlers), (err) => {
  if (err) throw err;
  console.log('notifier listening');
});

sub.on('message', async (channel, raw) => {
  try {
    await handlers[channel](JSON.parse(raw));
  } catch (e) {
    console.error(`${channel} handler failed`, e.message);
  }
});
