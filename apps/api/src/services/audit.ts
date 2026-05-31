import { prisma } from '../db';
import type { Prisma } from '@prisma/client';

/** Пишет запись аудита. Никогда не роняет основной запрос. */
export async function writeAudit(
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId?: string | null,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        payload: payload ?? undefined,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit] не удалось записать:', e);
  }
}
