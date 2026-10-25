// Level sirens and strobes are driven by a small controller on the surface network.
const axios = require('axios');

async function activate(levelCode, mode) {
  try {
    await axios.post(`${process.env.SIREN_CONTROLLER_URL}/zones/${levelCode}`, { mode }, { timeout: 3000 });
  } catch (e) {
    // the PLC sounds the siren on its own for an evacuate-level reading; this is a backup path
    console.error(`siren ${levelCode} ${mode} failed`, e.message);
  }
}

module.exports = { activate };
