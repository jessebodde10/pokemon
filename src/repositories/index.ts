import { serverConfig } from '@/config/env';
import { supabaseConfigured } from '@/config/public';
import { logger } from '@/lib/logging/logger';
import type { ValtivoRepository } from './valtivo-repository';
import { InMemoryValtivoRepository } from './in-memory-repository';
import { SupabaseValtivoRepository } from './supabase-repository';

let repository: ValtivoRepository | null = null;

/**
 * Returns the active repository. Supabase is used as soon as a project URL,
 * anon key and service-role key are present; otherwise the app runs on the
 * in-memory store so `pnpm dev` and the test suites need no external service.
 */
export function getRepository(): ValtivoRepository {
  if (repository) return repository;
  const useSupabase =
    supabaseConfigured && serverConfig.supabase.serviceRoleKey.length > 0;
  repository = useSupabase
    ? new SupabaseValtivoRepository()
    : new InMemoryValtivoRepository();
  logger.info('Repository resolved', { repository: repository.name });
  return repository;
}

/** Test seam. */
export function setRepository(next: ValtivoRepository | null): void {
  repository = next;
}

export const isPersistentStore = (): boolean =>
  getRepository().name === 'supabase';

export type { ValtivoRepository };
