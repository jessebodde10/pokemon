import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverConfig } from '@/config/env';
import { publicConfig, supabaseConfigured } from '@/config/public';
import { logger } from '@/lib/logging/logger';
import { getServiceRoleClient } from '@/lib/supabase/service-client';

/**
 * Object storage abstraction.
 *
 * Uploaded photos are private. Filenames are always generated server-side so a
 * malicious original filename can never influence the storage path, and reads
 * always go through a short-lived signed URL.
 */
export interface FileStorage {
  readonly name: string;
  /** Returns the storage path (never a URL). */
  put(key: string, body: Uint8Array, contentType: string): Promise<string>;
  read(storagePath: string): Promise<{ body: Uint8Array; contentType: string }>;
  createSignedUrl(
    storagePath: string,
    expiresInSeconds?: number,
  ): Promise<string>;
  remove(storagePaths: string[]): Promise<void>;
}

/** Generates a collision-free, non-guessable storage path. */
export function buildStorageKey(
  sessionId: string,
  originalFilename: string,
): string {
  const extension =
    path
      .extname(originalFilename)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '') || '.bin';
  const random = randomBytes(16).toString('hex');
  return `${sessionId}/${random}${extension}`;
}

const LOCAL_ROOT = path.join(process.cwd(), '.valtivo-storage');

const CONTENT_TYPE_FILE = '.content-type';

/**
 * Development storage: writes to a git-ignored folder and serves bytes through
 * an authorised route handler. Only used when Supabase is not configured.
 */
export class LocalFileStorage implements FileStorage {
  readonly name = 'local-file-storage';

  private resolve(storagePath: string): string {
    const normalised = path
      .normalize(storagePath)
      .replace(/^([.]{2}[\\/])+/, '');
    const resolved = path.resolve(LOCAL_ROOT, normalised);
    if (!resolved.startsWith(path.resolve(LOCAL_ROOT))) {
      throw new Error('Refusing to access a path outside the storage root');
    }
    return resolved;
  }

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<string> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    await writeFile(`${target}${CONTENT_TYPE_FILE}`, contentType, 'utf8');
    return key;
  }

  async read(
    storagePath: string,
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const target = this.resolve(storagePath);
    const body = await readFile(target);
    let contentType = 'application/octet-stream';
    try {
      contentType = (
        await readFile(`${target}${CONTENT_TYPE_FILE}`, 'utf8')
      ).trim();
    } catch {
      // Missing sidecar is not fatal; fall back to a safe default.
    }
    return { body: new Uint8Array(body), contentType };
  }

  async createSignedUrl(
    storagePath: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = signLocalPath(storagePath, expiresAt);
    const params = new URLSearchParams({
      path: storagePath,
      expires: String(expiresAt),
      signature,
    });
    return `${publicConfig.appUrl.replace(/\/$/, '')}/api/storage?${params.toString()}`;
  }

  async remove(storagePaths: string[]): Promise<void> {
    await Promise.all(
      storagePaths.map(async (storagePath) => {
        const target = this.resolve(storagePath);
        await rm(target, { force: true });
        await rm(`${target}${CONTENT_TYPE_FILE}`, { force: true });
      }),
    );
  }
}

export function signLocalPath(storagePath: string, expiresAt: number): string {
  return createHash('sha256')
    .update(
      `${storagePath}:${expiresAt}:${serverConfig.security.rateLimitSalt}`,
    )
    .digest('hex');
}

export function verifyLocalSignature(
  storagePath: string,
  expiresAt: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signLocalPath(storagePath, expiresAt);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export class SupabaseFileStorage implements FileStorage {
  readonly name = 'supabase-storage';
  private readonly bucket = serverConfig.supabase.storageBucket;

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<string> {
    const client = getServiceRoleClient();
    const { error } = await client.storage
      .from(this.bucket)
      .upload(key, body, { contentType, upsert: false });
    if (error) {
      logger.error('Supabase storage upload failed', error);
      throw new Error('Upload to storage failed');
    }
    return key;
  }

  async read(
    storagePath: string,
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const client = getServiceRoleClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .download(storagePath);
    if (error || !data) throw new Error('Object not found');
    return {
      body: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || 'application/octet-stream',
    };
  }

  async createSignedUrl(
    storagePath: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const client = getServiceRoleClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data) throw new Error('Could not create signed URL');
    return data.signedUrl;
  }

  async remove(storagePaths: string[]): Promise<void> {
    if (storagePaths.length === 0) return;
    const client = getServiceRoleClient();
    await client.storage.from(this.bucket).remove(storagePaths);
  }
}

/** Volatile storage used by the test suites; writes nothing to disk. */
export class InMemoryFileStorage implements FileStorage {
  readonly name = 'in-memory-storage';
  private readonly objects = new Map<
    string,
    { body: Uint8Array; contentType: string }
  >();

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<string> {
    this.objects.set(key, { body, contentType });
    return key;
  }

  async read(
    storagePath: string,
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const object = this.objects.get(storagePath);
    if (!object) throw new Error('Object not found');
    return object;
  }

  async createSignedUrl(storagePath: string): Promise<string> {
    return `memory://${storagePath}`;
  }

  async remove(storagePaths: string[]): Promise<void> {
    for (const path of storagePaths) this.objects.delete(path);
  }
}

let storage: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (storage) return storage;
  storage =
    supabaseConfigured && serverConfig.supabase.serviceRoleKey
      ? new SupabaseFileStorage()
      : new LocalFileStorage();
  return storage;
}

/** Test seam. */
export function setFileStorage(next: FileStorage | null): void {
  storage = next;
}
