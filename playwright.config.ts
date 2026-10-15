import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/artifacts',

  // El mock tiene un único estado en memoria y cada test lo reinicia:
  // ejecutar en paralelo haría que un reset borre los datos de otro test.
  fullyParallel: false,
  workers: 1,
  // Sin reintentos: un fallo real aparece una sola vez y no se disfraza de "inestable".
  retries: 0,
  forbidOnly: !!process.env.CI,

  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    // Evidencia solo cuando un test falla.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Levanta el mock solo si no está corriendo.
  webServer: {
    command: 'npm --prefix mock-app start',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
