const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'live.spec.cjs',
  timeout: 90000,
  globalTimeout: 10 * 60 * 1000,
  expect: { timeout: 30000 },
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'results.json' }]],
  use: {
    browserName: 'chromium',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 45000
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: {
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
    } }
  ]
});
