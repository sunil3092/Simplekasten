import { defineConfig, devices } from "@playwright/test";

const API_PORT = 4100;
const WEB_PORT = 3100;
const DATABASE_URL = "postgresql://vaultvista:vaultvista@localhost:5432/vaultvista_e2e";

export default defineConfig({
  testDir: "./tests",
  // This sandbox has little CPU to spare: two workers each driving a full
  // Chromium, alongside the Next.js dev server and scrypt password hashing
  // on the API, was enough contention to push registration past a 30s
  // timeout once several tests piled up (every failure died at that exact
  // step). Serial execution is slower wall-clock but actually reliable here;
  // raise workers back up on real CI hardware.
  workers: 1,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    launchOptions: {
      // This container's Chromium was pre-installed at a pinned revision
      // outside Playwright's normal download flow — point at it explicitly
      // rather than letting Playwright try to fetch its expected version.
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      args: ["--no-sandbox"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node_modules/.bin/tsx src/index.ts",
      cwd: "../apps/api",
      env: { DATABASE_URL, JWT_SECRET: "e2e-secret", PORT: String(API_PORT) },
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `node_modules/.bin/next dev -p ${WEB_PORT}`,
      cwd: "../apps/web",
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
