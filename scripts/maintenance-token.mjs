import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Prints the token for POST /api/maintenance/cleanup.
 *
 * Derived from RATE_LIMIT_SALT so no separate secret has to be managed. Reads
 * .env.local when present so the printed token matches the running app.
 */
function readSaltFromEnvFile() {
  for (const file of ['.env.local', '.env']) {
    try {
      const contents = readFileSync(file, 'utf8');
      const match = /^RATE_LIMIT_SALT=(.*)$/m.exec(contents);
      const value = match?.[1]?.trim();
      if (value) return value;
    } catch {
      // File absent; try the next one.
    }
  }
  return null;
}

const salt =
  process.env.RATE_LIMIT_SALT ??
  readSaltFromEnvFile() ??
  'pokora-ai-development-salt';

const token = createHmac('sha256', salt)
  .update('pokora-ai:maintenance')
  .digest('hex');

process.stdout.write(
  `Maintenance token (send as x-maintenance-token):\n${token}\n`,
);
