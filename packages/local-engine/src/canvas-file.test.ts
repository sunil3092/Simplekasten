import { describe, expect, it } from "vitest";
import { parseCanvasFile, serializeCanvasFile } from "./canvas-file";
import type { CanvasData } from "./types";

describe("canvas-file round-trip", () => {
  it("serializes then parses back to the same canvas", () => {
    const canvas: CanvasData = {
      id: "c1",
      title: "Project layout",
      cards: [
        { id: "card1", kind: "note", noteId: "n1", x: 0, y: 0, width: 200, height: 120 },
        { id: "card2", kind: "text", text: "A scratch thought.", x: 250, y: 40, width: 180, height: 100 },
      ],
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
    };

    expect(parseCanvasFile(serializeCanvasFile(canvas), canvas.id)).toEqual(canvas);
  });

  it("round-trips an empty canvas with no cards", () => {
    const canvas: CanvasData = {
      id: "c2",
      title: "Blank",
      cards: [],
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
    };

    expect(parseCanvasFile(serializeCanvasFile(canvas), canvas.id)).toEqual(canvas);
  });

  it("defaults missing fields when parsing a malformed file", () => {
    const parsed = parseCanvasFile("{}", "c3");
    expect(parsed.id).toBe("c3");
    expect(parsed.title).toBe("Untitled canvas");
    expect(parsed.cards).toEqual([]);
  });

  it("throws parsing invalid JSON", () => {
    expect(() => parseCanvasFile("not json", "c4")).toThrow();
  });

  it("uses the filename id even if the serialized data carried a different one", () => {
    const canvas: CanvasData = { id: "original", title: "T", cards: [], createdAt: "2026-09-25T00:00:00.000Z", updatedAt: "2026-09-25T00:00:00.000Z" };
    const raw = serializeCanvasFile(canvas);
    expect(parseCanvasFile(raw, "renamed").id).toBe("renamed");
  });
});
