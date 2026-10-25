// Fan status and airflow come from the SCADA historian's web API.
// Writes (setpoint changes) go through the historian's write-request endpoint, which the
// control system applies only if the fan is in REMOTE mode.
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.SCADA_HISTORIAN_URL,
  timeout: 8000,
  auth: { username: process.env.SCADA_USER || '', password: process.env.SCADA_PASSWORD || '' },
});

const STATUS_MAP = { 0: 'STOPPED', 1: 'RUNNING', 2: 'FAULT' };

// tag paths look like \\CORVANE-SCADA\Vent\BF-1250-A
async function readFan(scadaTag) {
  const { data } = await client.get('/streams/value', {
    params: { path: scadaTag, fields: 'RunState;SpeedHz;Airflow' },
  });
  return {
    status: STATUS_MAP[data.RunState] ?? 'UNKNOWN',
    speedHz: data.SpeedHz,
    airflowM3s: data.Airflow,
    at: data.Timestamp,
  };
}

async function requestSetpoint(scadaTag, hz, requestedBy) {
  const { data } = await client.post('/writerequests', {
    path: `${scadaTag}.SpeedSetpoint`,
    value: hz,
    requestedBy,
    reason: 'VentOps setpoint change',
  });
  return data; // { requestId, state: 'QUEUED' | 'REJECTED_LOCAL_MODE' }
}

module.exports = { readFan, requestSetpoint };
