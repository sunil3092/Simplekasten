import { defineConfig } from "vitest/config";

// Pure-function unit tests — no database, no network. See vitest.integration.config.ts
// for router/DB tests, which need a real Postgres instance.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
