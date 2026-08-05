import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';
import {
  deleteExpiredGuestAnalyses,
  isValidMaintenanceToken,
} from '@/services/retention-service';

export const dynamic = 'force-dynamic';

/**
 * Removes expired guest analyses. Intended for a scheduler (cron job, Vercel
 * Cron, Supabase pg_cron). Requires the maintenance token so the endpoint
 * cannot be used as a free load generator.
 */
export async function POST(request: Request) {
  const token =
    request.headers.get('x-maintenance-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null;

  if (!isValidMaintenanceToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await deleteExpiredGuestAnalyses();
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Maintenance cleanup failed', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
