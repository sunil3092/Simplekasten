import type { CanvasData } from "./types";

// A canvas's "content" is structured data, not markdown, so it's stored as
// plain JSON rather than the frontmatter+body shape note files use — same
// "non-markdown vault data is just a JSON file" convention packages/themes
// already uses for installed themes.

export function parseCanvasFile(raw: string, id: string): CanvasData {
  const parsed = JSON.parse(raw) as Partial<CanvasData>;
  const now = new Date().toISOString();
  return {
    id,
    title: parsed.title ?? "Untitled canvas",
    cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    createdAt: parsed.createdAt ?? now,
    updatedAt: parsed.updatedAt ?? now,
  };
}

export function serializeCanvasFile(canvas: CanvasData): string {
  const { id: _id, ...rest } = canvas;
  return JSON.stringify(rest, null, 2);
}
