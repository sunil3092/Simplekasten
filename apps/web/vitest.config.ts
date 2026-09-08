import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Next.js tsconfig sets jsx:"preserve" (Next's own SWC transform handles
  // it at build time); Vitest runs through esbuild directly, so it needs the
  // automatic runtime told explicitly or every .tsx test fails with "React is
  // not defined".
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
