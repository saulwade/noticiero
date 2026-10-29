import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3001";
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
    command: `npm run dev -- --port ${new URL(baseURL).port || "3001"}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
