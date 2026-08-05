import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';
import {
  LocalFileStorage,
  getFileStorage,
  verifyLocalSignature,
} from '@/repositories/storage';

export const dynamic = 'force-dynamic';

/**
 * Serves objects from the local development store.
 *
 * Access requires a valid, unexpired HMAC signature produced by
 * `LocalFileStorage.createSignedUrl`; there is no way to enumerate or guess a
 * path. When Supabase storage is active this route is not used at all.
 */
export async function GET(request: Request) {
  const storage = getFileStorage();
  if (!(storage instanceof LocalFileStorage)) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');

  if (!path || !signature || !Number.isFinite(expires)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!verifyLocalSignature(path, expires, signature)) {
    return NextResponse.json(
      { error: 'Invalid or expired link' },
      { status: 403 },
    );
  }

  try {
    const object = await storage.read(path);
    return new NextResponse(Buffer.from(object.body), {
      headers: {
        'content-type': object.contentType,
        'cache-control': 'private, max-age=300',
        'content-disposition': 'inline',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    logger.warn('Storage object not found', { error: String(error) });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
