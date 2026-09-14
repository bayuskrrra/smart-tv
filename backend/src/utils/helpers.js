import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createAuditLog(userId, action, entity, entityId, details = null) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isOverdue(tglKembaliRencana) {
  return new Date() > new Date(tglKembaliRencana);
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
