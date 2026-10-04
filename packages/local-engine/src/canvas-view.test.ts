import { describe, expect, it } from "vitest";
import { CANVAS_CARD, generateCanvasCardId, moveCanvasCard, newCanvasCard, resizeCanvasCard } from "./canvas-view";
import type { CanvasCard } from "./types";

const card: CanvasCard = { id: "c1", kind: "text", text: "hello", x: 10, y: 20, width: 220, height: 140 };

describe("newCanvasCard", () => {
  it("makes a default-sized card centred on the point", () => {
    const made = newCanvasCard({ kind: "note", noteId: "n1" }, { x: 500, y: 300 });
    expect(made).toMatchObject({ kind: "note", noteId: "n1", x: 390, y: 230, width: CANVAS_CARD.defaultWidth, height: CANVAS_CARD.defaultHeight });
  });

  it("keeps a text card's text", () => {
    expect(newCanvasCard({ kind: "text", text: "" }, { x: 0, y: 0 })).toMatchObject({ kind: "text", text: "" });
  });

  it("gives every card its own id", () => {
    const ids = new Set(Array.from({ length: 50 }, generateCanvasCardId));
    expect(ids.size).toBe(50);
  });
});

describe("moveCanvasCard", () => {
  it("shifts the card and leaves its size and content alone", () => {
    expect(moveCanvasCard(card, 15, -30)).toEqual({ ...card, x: 25, y: -10 });
  });
});

describe("resizeCanvasCard", () => {
  it("grows and shrinks from the corner", () => {
    expect(resizeCanvasCard(card, 40, 20)).toEqual({ ...card, width: 260, height: 160 });
  });

  it("stops at the minimum size", () => {
    expect(resizeCanvasCard(card, -500, -500)).toEqual({ ...card, width: CANVAS_CARD.minWidth, height: CANVAS_CARD.minHeight });
  });
});
