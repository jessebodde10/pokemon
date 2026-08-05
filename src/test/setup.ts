/**
 * Test bootstrap.
 *
 * Pins the environment to deterministic mock mode before any module reads
 * `process.env`, so unit and integration tests never depend on a developer's
 * local .env file.
 */
// NODE_ENV is set to 'test' by Vitest itself and is read-only under the
// Next.js TypeScript config, so it is deliberately not assigned here.
process.env.APP_MODE = 'mock';
process.env.RATE_LIMIT_SALT = 'test-salt-do-not-use-in-production';
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.DEV_FORCE_PROVIDER_ERROR = 'none';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.GUEST_MAX_IMAGES = '3';
process.env.USER_MAX_IMAGES = '10';
process.env.GUEST_DAILY_ANALYSIS_LIMIT = '1';
process.env.USER_DAILY_ANALYSIS_LIMIT = '5';
process.env.GUEST_DAILY_ATTEMPT_LIMIT = '3';
process.env.USER_DAILY_ATTEMPT_LIMIT = '25';
process.env.ATTENTION_VALUE_THRESHOLD_EUR = '25';
