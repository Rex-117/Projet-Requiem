const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 75000,
  expect: { timeout: 10000 },
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/chat-fixture.cjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
