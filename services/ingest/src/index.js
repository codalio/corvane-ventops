// Subscribes to gas sensor telemetry on the site MQTT broker (published by the
// underground PLCs / gas monitoring outstations), batches readings and posts them
// to the API, and watches for sensors that go quiet.
const mqtt = require('mqtt');
const axios = require('axios');
const { parse } = require('./parser');
const staleWatch = require('./staleWatch');

const api = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:4000',
  timeout: 10000,
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

const BATCH_MS = 2000;
let batch = [];

const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', {
  clientId: `ventops-ingest-${process.pid}`,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log('ingest connected to broker');
  client.subscribe('corvane/north/+/+/+', { qos: 1 });
});

client.on('message', (topic, payload) => {
  const reading = parse(topic, payload);
  if (!reading) return;
  staleWatch.seen(topic, reading.ts);
  batch.push(reading);
});

async function flush() {
  if (batch.length === 0) return;
  const toSend = batch;
  batch = [];
  try {
    await api.post('/internal/readings', { readings: toSend });
  } catch (e) {
    console.error(`posting ${toSend.length} readings failed, requeueing`, e.message);
    // put them back at the front; drop the oldest if the API has been down a long time
    batch = toSend.concat(batch).slice(-5000);
  }
}

setInterval(flush, BATCH_MS);

staleWatch.start(async (topic, lastSeenAt) => {
  try {
    await api.post('/internal/sensor-fault', { topic, lastSeenAt });
  } catch (e) {
    console.error('sensor-fault post failed', e.message);
  }
});
