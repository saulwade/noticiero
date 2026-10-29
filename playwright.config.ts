import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.E2E_APP_URL ?? "http://127.0.0.1:3101";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command: "node --import tsx scripts/e2e-server.ts",
    env: { E2E_PORT: new URL(baseURL).port || "3101" },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
