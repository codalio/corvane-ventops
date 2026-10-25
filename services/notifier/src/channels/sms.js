const axios = require('axios');

async function send(to, text) {
  if (!to) return;
  try {
    await axios.post(
      process.env.SMS_GATEWAY_URL,
      { to, text: text.slice(0, 320) },
      { headers: { Authorization: `Key ${process.env.SMS_GATEWAY_KEY}` }, timeout: 5000 }
    );
  } catch (e) {
    console.error(`sms to ${to} failed`, e.message);
  }
}

module.exports = { send };
