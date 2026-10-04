import { describe, expect, it } from "vitest";
import { noteTypeSchema } from "./schemas";

describe("noteTypeSchema", () => {
  // Spelled out rather than looped over the schema's own options, so adding
  // or renaming a note type has to be a deliberate edit here too: every
  // note type needs a NOTE_TYPES entry (badge + graph colour) alongside it.
  it("is exactly the five note types a vault can store", () => {
    expect(noteTypeSchema.options).toEqual(["fleeting", "literature", "permanent", "structure", "daily"]);
  });

  it("accepts each one of them", () => {
    for (const type of noteTypeSchema.options) {
      expect(noteTypeSchema.safeParse(type).success, type).toBe(true);
    }
  });

  it("rejects anything else, including near-misses of a real type", () => {
    for (const bad of ["archived", "Daily", "fleeting ", "", "permanent-note"]) {
      expect(noteTypeSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
