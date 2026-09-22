import { noteTypeSchema } from "@simplekasten/core";
import { describe, expect, it } from "vitest";
import { NOTE_TYPES, noteTypeInfo } from "./noteTypes";
import { COLOR_KEYS } from "./schema";

describe("NOTE_TYPES", () => {
  it("has exactly one entry per note type", () => {
    expect(NOTE_TYPES.map((t) => t.value).sort()).toEqual([...noteTypeSchema.options].sort());
  });

  it("only references real theme colour keys", () => {
    for (const t of NOTE_TYPES) {
      for (const key of [t.graphColor, t.badge.bg, t.badge.fg, t.badge.border]) {
        expect(COLOR_KEYS, `${t.value}: ${key}`).toContain(key);
      }
    }
  });

  it("falls back to fleeting for an unknown type", () => {
    expect(noteTypeInfo("nonsense").value).toBe("fleeting");
    expect(noteTypeInfo("structure").badge.dashed).toBe(true);
  });
});
