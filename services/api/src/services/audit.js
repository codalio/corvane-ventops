const prisma = require('../db');

async function log(userId, action, entity, entityId, detail) {
  try {
    await prisma.auditEvent.create({
      data: { userId, action, entity, entityId: String(entityId), detail: detail || undefined },
    });
  } catch (e) {
    // never block an operator action on the audit write
    console.error('audit write failed', e.message);
  }
}

module.exports = { log };
