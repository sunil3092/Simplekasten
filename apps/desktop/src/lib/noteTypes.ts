import type { ColorKey } from "@simplekasten/themes";

export type NoteType = "fleeting" | "literature" | "permanent" | "structure";

interface NoteTypeInfo {
  value: NoteType;
  label: string;
  /** Classes for the type picker badge in the note header. */
  badge: string;
  /** Theme colour used for the note's node in the graph. */
  graphColor: ColorKey;
}

// One entry per note type — the type picker, its badge and the graph legend
// all read from here, so a type's look can't drift between screens.
export const NOTE_TYPES: NoteTypeInfo[] = [
  { value: "fleeting", label: "Fleeting", badge: "bg-surface-2 text-ink-muted border-line", graphColor: "accent2" },
  { value: "literature", label: "Literature", badge: "bg-accent-2-soft text-accent-2 border-accent-2", graphColor: "accent" },
  { value: "permanent", label: "Permanent", badge: "bg-accent-soft text-accent-ink border-accent", graphColor: "ink" },
  { value: "structure", label: "Structure", badge: "bg-surface-2 text-ink-muted border-line border-dashed", graphColor: "inkMuted" },
];

const FALLBACK = NOTE_TYPES[0];

export function noteTypeInfo(type: string): NoteTypeInfo {
  return NOTE_TYPES.find((t) => t.value === type) ?? FALLBACK;
}
