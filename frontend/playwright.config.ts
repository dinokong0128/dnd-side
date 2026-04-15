import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
            '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
  webServer: {
    command: 'E2E_TESTING=true NEXT_PUBLIC_E2E_TESTING=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_TESTING: 'true',
      NEXT_PUBLIC_E2E_TESTING: 'true',
    },
  },
})
