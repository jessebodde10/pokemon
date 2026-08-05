import { defineConfig, devices } from '@playwright/test';

/**
 * Two servers, on purpose.
 *
 * The guest journey runs against a real production build - that is the MVP's
 * core flow and deserves the highest-fidelity check.
 *
 * The signed-in journey runs against the dev server, because the development
 * auth fallback is deliberately disabled when NODE_ENV=production. That guard
 * is what stops a deploy that still carries the example .env from shipping an
 * open login, so it is not weakened to make a test pass. With a real Supabase
 * project both suites would run against the production build.
 */
const PROD_PORT = Number(process.env.E2E_PORT ?? 3100);
const DEV_PORT = Number(process.env.E2E_DEV_PORT ?? 3101);

const prodUrl = `http://127.0.0.1:${PROD_PORT}`;
const devUrl = `http://127.0.0.1:${DEV_PORT}`;

const sharedEnv = {
  APP_MODE: 'mock',
  RATE_LIMIT_SALT: 'e2e-static-salt',
  RATE_LIMIT_ENABLED: 'false',
  DEV_AUTH_FALLBACK: 'true',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },

  projects: [
    {
      name: 'guest-production-build',
      testMatch: /guest-analysis\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: prodUrl },
    },
    {
      name: 'signed-in-dev-server',
      testMatch: /logged-in-collection\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: devUrl },
    },
  ],

  webServer: [
    {
      command: `pnpm build && pnpm start --port ${PROD_PORT}`,
      url: prodUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { ...sharedEnv, NEXT_PUBLIC_APP_URL: prodUrl },
    },
    {
      command: `pnpm dev --port ${DEV_PORT}`,
      url: devUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...sharedEnv,
        NEXT_PUBLIC_APP_URL: devUrl,
        // Own build directory: sharing .next would overwrite the production
        // build that the other server is serving.
        NEXT_DIST_DIR: '.next-e2e-dev',
      },
    },
  ],
});
