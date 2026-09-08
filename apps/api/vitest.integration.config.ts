import { defineConfig } from "vitest/config";

// Router/DB tests against a real Postgres instance (see .env.test /
// package.json's db:test:setup). Run with a single worker: these tests share
// one database and rely on each other's rows not overlapping, which unique
// per-test emails/kb slugs already guarantee without needing table locks —
// forcing one worker just keeps failures easy to read, not correctness.
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
