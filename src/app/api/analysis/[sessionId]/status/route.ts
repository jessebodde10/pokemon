import { NextResponse } from 'next/server';
import { getRequester } from '@/features/auth/requester';
import { isAppError, toUserMessage } from '@/lib/errors/app-error';
import { getSessionStatus } from '@/services/analysis-service';
import { progressPercent } from '@/services/analysis-state';

export const dynamic = 'force-dynamic';

/**
 * Status endpoint polled by the processing screen. Returns only the fields the
 * UI needs; the requester is resolved server-side and authorised on every hit.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  try {
    const session = await getSessionStatus({
      sessionId,
      requester: await getRequester(),
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        status: session.status,
        step: session.statusDetail,
        progress: progressPercent(session.status, session.statusDetail),
        detectedCards: session.detectedCardsCount,
        totalImages: session.totalImages,
        errorMessage: session.errorMessage,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: toUserMessage(error) },
      { status: isAppError(error) ? error.httpStatus : 500 },
    );
  }
}
