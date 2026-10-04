import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Not a test run: regenerates the README walkthrough (see demo/tour.demo.ts).
// Kept out of the e2e suite so `npm run test:e2e` never rewrites the GIF.
export default defineConfig({
  ...base,
  testDir: "./demo",
  testMatch: "**/*.demo.ts",
});
