import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points the suite at a running deploy (e.g. the Docker image),
// which is the only way to exercise the production nginx headers and CSP.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL, acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
});
