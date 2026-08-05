import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverConfig } from '@/config/env';
import { logger } from '@/lib/logging/logger';
import { getRepository } from '@/repositories';
import { getFileStorage } from '@/repositories/storage';

/**
 * Guest retention.
 *
 * Guest analyses are temporary by design. This routine deletes every expired
 * guest session together with its uploaded photos. It is safe to run at any
 * time and only ever touches rows that are already past their expiry.
 */
export async function deleteExpiredGuestAnalyses(
  now: Date = new Date(),
): Promise<{ sessions: number; objects: number }> {
  const repository = getRepository();
  const storage = getFileStorage();
  const expired = await repository.listExpiredGuestSessions(now.toISOString());

  let objects = 0;
  for (const session of expired) {
    const images = await repository.listImages(session.id);
    if (images.length > 0) {
      await storage
        .remove(images.map((image) => image.storagePath))
        .catch((error) =>
          logger.warn('Retention: storage cleanup failed', {
            error: String(error),
          }),
        );
      objects += images.length;
    }
    await repository.deleteSession(session.id);
  }

  if (expired.length > 0) {
    logger.info('Retention run complete', {
      sessions: expired.length,
      objects,
    });
  }
  return { sessions: expired.length, objects };
}

/**
 * Token for the maintenance endpoint, derived from RATE_LIMIT_SALT so no
 * separate secret has to be configured. Printed by `pnpm maintenance:token`.
 */
export function maintenanceToken(): string {
  return createHmac('sha256', serverConfig.security.rateLimitSalt)
    .update('valtivo-ai:maintenance')
    .digest('hex');
}

export function isValidMaintenanceToken(supplied: string | null): boolean {
  if (!supplied) return false;
  const expected = maintenanceToken();
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
