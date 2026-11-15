import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  outputDir: "work/browser-artifacts",
  reporter: [["list"], ["json", { outputFile: "work/browser-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: { executablePath, args: ["--disable-dev-shm-usage"] },
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173/api/v1/categories",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
