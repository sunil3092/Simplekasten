import { NOTE_TYPES, noteTypeInfo, type ColorKey } from "@simplekasten/themes";

export type { NoteType } from "@simplekasten/core";
export { NOTE_TYPES, noteTypeInfo };

// The shared table (packages/themes/src/noteTypes.ts) names theme colours;
// Tailwind needs literal class names to generate them, so each colour key
// used by a badge maps to its utility here.
const BG: Partial<Record<ColorKey, string>> = { surface2: "bg-surface-2", accentSoft: "bg-accent-soft", accent2Soft: "bg-accent-2-soft", lineSoft: "bg-line-soft" };
const FG: Partial<Record<ColorKey, string>> = { inkMuted: "text-ink-muted", accentInk: "text-accent-ink", accent2: "text-accent-2", ink: "text-ink" };
const BORDER: Partial<Record<ColorKey, string>> = { line: "border-line", accent: "border-accent", accent2: "border-accent-2" };

/** Tailwind classes for a note type's badge/picker in the note header. */
export function badgeClasses(type: string): string {
  const { badge } = noteTypeInfo(type);
  return [BG[badge.bg], FG[badge.fg], BORDER[badge.border], badge.dashed && "border-dashed"].filter(Boolean).join(" ");
}
