// Personnel and vehicle tracking ("tag board"). Each person and each vehicle carries
// a tag; readers at level entries report where they are.
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.TAGBOARD_URL,
  timeout: 5000,
  headers: { 'X-Api-Key': process.env.TAGBOARD_API_KEY || '' },
});

// [{ tagId, name, crew, phone, levelCode, since }]
async function personnelOnLevel(levelCode) {
  const { data } = await client.get(`/zones/${encodeURIComponent(levelCode)}/people`);
  return (data.items || []).map((p) => ({
    tagId: p.tag_id,
    name: `${p.first_name} ${p.last_name}`,
    crew: p.crew,
    phone: p.mobile,
    levelCode,
    since: p.entered_at,
  }));
}

// [{ unitId, kind, levelCode }]
async function vehiclesUnderground() {
  const { data } = await client.get('/vehicles', { params: { underground: true } });
  return (data.items || []).map((v) => ({ unitId: v.unit_id, kind: v.class, levelCode: v.zone }));
}

async function headcount() {
  const { data } = await client.get('/headcount');
  return data; // { total, byZone: { 'L-1250': 14, ... } }
}

module.exports = { personnelOnLevel, vehiclesUnderground, headcount };
