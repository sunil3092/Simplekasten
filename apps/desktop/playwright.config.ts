import { defineConfig } from "@playwright/test";

// The renderer is a plain Next app; the Electron preload bridge is stubbed in
// each spec (see e2e/bridge.ts), so no Electron process is needed.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Outside apps/desktop: Next dev watches this folder, and writing screenshots
  // into it triggers a hot reload that races the test running next.
  outputDir: "../../test-results",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev:renderer",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
