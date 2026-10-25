// Maintenance system: failed sensors and faulted fans become work orders.
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.CMMS_URL,
  timeout: 8000,
  headers: { Authorization: `Bearer ${process.env.CMMS_API_KEY || ''}` },
});

async function createWorkOrder({ assetCode, title, description, priority = 'P2' }) {
  const { data } = await client.post('/workorders', {
    asset: assetCode,
    title,
    description,
    priority,
    department: 'VENTILATION',
    source: 'VentOps',
  });
  return data.id;
}

async function workOrderStatus(id) {
  const { data } = await client.get(`/workorders/${id}`);
  return data.status;
}

module.exports = { createWorkOrder, workOrderStatus };
