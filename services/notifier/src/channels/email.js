const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

async function send(to, subject, text) {
  const recipients = (to || []).filter(Boolean);
  if (recipients.length === 0) return;
  try {
    await transport.sendMail({ from: 'VentOps <ventops@corvane.example>', to: recipients.join(','), subject, text });
  } catch (e) {
    console.error('email failed', e.message);
  }
}

module.exports = { send };
