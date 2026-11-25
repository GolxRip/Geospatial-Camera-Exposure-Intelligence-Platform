import { defineConfig, devices } from '@playwright/test';

/**
 * The app and the backend are started by hand (see FRONTEND_SPEC.md section 24); this config
 * only drives the browser. Three viewports from the definition of done: 1366x768, 768 and 375 wide.
 * A fourth project covers the 1024 to 1279 band of FRONTEND_SPEC.md section 21. Pinned to @playwright/test 1.56.0 so it matches the Chromium build installed in PLAYWRIGHT_BROWSERS_PATH.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'off',
    // On a machine with no GPU (a CI container, say) set E2E_SOFTWARE_GL=1 so the map can create a WebGL context.
    launchOptions: {
      args: process.env.E2E_SOFTWARE_GL
        ? [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ]
        : [],
    },
  },
  projects: [
    {
      name: 'desktop-1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'laptop-1100',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
});
