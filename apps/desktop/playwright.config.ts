import { defineConfig } from "@playwright/test";

// The renderer is a plain Next app; the Electron preload bridge is stubbed in
// each spec (see e2e/bridge.ts), so no Electron process is needed.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Outside apps/desktop: Next dev watches this folder, and writing screenshots
  // into it triggers a hot reload that races the test running next.
  outputDir: "../../test-results",
  // Some sandboxes pre-install Chromium at a pinned revision outside
  // Playwright's normal download flow, under a path this repo's Playwright
  // version doesn't expect by default — set PLAYWRIGHT_CHROMIUM_EXECUTABLE
  // to point at it there. Unset (the normal case, including CI), this is a
  // no-op and Playwright resolves its own browser as usual.
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  webServer: {
    command: "npm run dev:renderer",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
