import type { NoteType } from "@simplekasten/core";
import type { ColorKey } from "./schema";

export interface NoteTypeInfo {
  value: NoteType;
  label: string;
  /** Theme colour used for the note's node in the graph and its legend dot. */
  graphColor: ColorKey;
  /** Theme colours for the type badge/picker in the note header. */
  badge: { bg: ColorKey; fg: ColorKey; border: ColorKey; dashed?: boolean };
}

// One entry per note type — both apps' type pickers, badges and graph
// legends read from here, so a type's look can't drift between screens or
// between desktop and mobile. Colours are theme keys, never raw values.
export const NOTE_TYPES: NoteTypeInfo[] = [
  { value: "fleeting", label: "Fleeting", graphColor: "accent2", badge: { bg: "surface2", fg: "inkMuted", border: "line" } },
  { value: "literature", label: "Literature", graphColor: "accent", badge: { bg: "accent2Soft", fg: "accent2", border: "accent2" } },
  { value: "permanent", label: "Permanent", graphColor: "ink", badge: { bg: "accentSoft", fg: "accentInk", border: "accent" } },
  { value: "structure", label: "Structure", graphColor: "inkMuted", badge: { bg: "surface2", fg: "inkMuted", border: "line", dashed: true } },
];

export function noteTypeInfo(type: string): NoteTypeInfo {
  return NOTE_TYPES.find((t) => t.value === type) ?? NOTE_TYPES[0];
}
