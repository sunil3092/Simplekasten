import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library's auto-cleanup only self-registers when it detects
// Jest-style test globals; this project imports describe/it/expect
// explicitly instead, so it has to be wired up by hand or every test after
// the first renders on top of the previous test's leftover DOM.
afterEach(() => {
  cleanup();
});
