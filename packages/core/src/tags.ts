import { normalizeTagName } from "./links";

export interface TagPickerRow {
  name: string;
  /** Notes in the vault with this tag (0 for one only just typed). */
  noteCount: number;
  /** On this note — assigned from the picker, or from a #hashtag in its text. */
  checked: boolean;
  /** Comes only from a #hashtag in the text, so the picker can't remove it. */
  locked: boolean;
}

export interface TagPickerState {
  rows: TagPickerRow[];
  /** A valid new name the query would create, if it isn't already listed. */
  create: string | null;
  /** The query can't be a tag name at all (e.g. "two words"). */
  invalid: boolean;
}

/**
 * What the tag picker shows for a note — shared by desktop's dropdown and
 * mobile's sheet so both list, lock and offer "Create" identically. The
 * note's own tags come first, then the rest of the vault's by popularity.
 */
export function tagPickerState(input: {
  vaultTags: { name: string; noteCount: number }[];
  assigned: string[];
  /** Every tag on the note (assigned + #hashtags), as the engine reports it. */
  onNote: string[];
  query: string;
}): TagPickerState {
  const assigned = new Set(input.assigned);
  const onNote = new Set(input.onNote);
  const counts = new Map(input.vaultTags.map((t) => [t.name, t.noteCount]));
  for (const name of onNote) if (!counts.has(name)) counts.set(name, 1);

  const query = input.query.trim().replace(/^#/, "").toLowerCase();
  const rows = [...counts.entries()]
    .filter(([name]) => name.includes(query))
    .map(([name, noteCount]) => ({ name, noteCount, checked: onNote.has(name), locked: onNote.has(name) && !assigned.has(name) }))
    .sort((a, b) => Number(b.checked) - Number(a.checked) || b.noteCount - a.noteCount || a.name.localeCompare(b.name));

  const normalized = query ? normalizeTagName(query) : null;
  return {
    rows,
    create: normalized && !counts.has(normalized) ? normalized : null,
    invalid: query.length > 0 && normalized === null,
  };
}

/** The note's assigned tags after toggling `name` in the picker. */
export function toggleAssignedTag(assigned: string[], name: string): string[] {
  return assigned.includes(name) ? assigned.filter((t) => t !== name) : [...assigned, name].sort();
}
