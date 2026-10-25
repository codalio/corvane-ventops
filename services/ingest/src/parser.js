// Outstations publish either JSON {"v": 0.42, "t": 1730600000, "q": "GOOD"}
// or the older plain "0.42" payload from the 850 level units.
const RANGES = {
  ch4: [0, 5],
  co: [0, 1000],
  no2: [0, 50],
  o2: [0, 25],
  h2s: [0, 100],
  dpm: [0, 5],
};

function parse(topic, payload) {
  const parts = topic.split('/'); // corvane/north/L-1250/ch4/2
  const gas = parts[3];
  const text = payload.toString().trim();
  let value;
  let ts = new Date();
  let quality = 'GOOD';

  if (text.startsWith('{')) {
    try {
      const j = JSON.parse(text);
      value = Number(j.v);
      if (j.t) ts = new Date(j.t * 1000);
      if (j.q) quality = j.q;
    } catch (e) {
      return null;
    }
  } else {
    value = Number(text);
  }

  if (!Number.isFinite(value)) return null;
  // outstation reports BAD quality while warming up or in calibration mode: ignore
  if (quality !== 'GOOD') return null;
  const range = RANGES[gas];
  if (range && (value < range[0] || value > range[1])) return null;

  return { topic, value, ts: ts.toISOString() };
}

module.exports = { parse, RANGES };
