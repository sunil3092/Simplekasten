import type { CanvasCard } from "./types";

// What a canvas card is on screen, the same on desktop and mobile: how big a
// new one starts, how small one may be dragged, and how tall its header
// strip (the drag handle) is.
export const CANVAS_CARD = {
  defaultWidth: 220,
  defaultHeight: 140,
  minWidth: 140,
  minHeight: 90,
  headerHeight: 26,
} as const;

export function generateCanvasCardId(): string {
  return `card${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** A new card of the default size, centred on the given point of the canvas. */
export function newCanvasCard(content: { kind: "note"; noteId: string } | { kind: "text"; text: string }, centre: { x: number; y: number }): CanvasCard {
  return {
    id: generateCanvasCardId(),
    ...content,
    x: centre.x - CANVAS_CARD.defaultWidth / 2,
    y: centre.y - CANVAS_CARD.defaultHeight / 2,
    width: CANVAS_CARD.defaultWidth,
    height: CANVAS_CARD.defaultHeight,
  };
}

/** The card moved by a drag of (dx, dy) from where it was when the drag began. */
export function moveCanvasCard<T extends CanvasCard>(start: T, dx: number, dy: number): T {
  return { ...start, x: start.x + dx, y: start.y + dy };
}

/** The card resized by dragging its corner (dx, dy), never below the minimum size. */
export function resizeCanvasCard<T extends CanvasCard>(start: T, dx: number, dy: number): T {
  return {
    ...start,
    width: Math.max(CANVAS_CARD.minWidth, start.width + dx),
    height: Math.max(CANVAS_CARD.minHeight, start.height + dy),
  };
}
