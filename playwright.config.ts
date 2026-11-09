import { defineConfig } from '@playwright/test';

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 18080);

// Pruebas de navegador del recorrido de 6.4. Requieren Docker: no forman parte de `npm test`.
// Los specs comparten estado (pagar y activar se consumen una vez): van en orden y con un solo worker.
export default defineConfig({
  testDir: 'e2e/specs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    video: process.env.E2E_VIDEO === '1' ? 'on' : 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
