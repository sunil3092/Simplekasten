import { describe, expect, it } from "vitest";
import { ICONS } from "./icons";

describe("ICONS", () => {
  it("gives every icon at least one shape", () => {
    for (const [name, shapes] of Object.entries(ICONS)) {
      expect(shapes.length, name).toBeGreaterThan(0);
    }
  });

  it("keeps every path inside the 24x24 viewBox's command alphabet", () => {
    for (const [name, shapes] of Object.entries(ICONS)) {
      for (const shape of shapes) {
        if (shape.kind === "path") expect(shape.d, name).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
      }
    }
  });
});
