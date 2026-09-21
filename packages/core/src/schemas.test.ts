import { describe, expect, it } from "vitest";
import { noteTypeSchema } from "./schemas";

describe("noteTypeSchema", () => {
  it("accepts the four Zettelkasten note types", () => {
    for (const type of ["fleeting", "literature", "permanent", "structure"]) {
      expect(noteTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(noteTypeSchema.safeParse("archived").success).toBe(false);
  });
});
