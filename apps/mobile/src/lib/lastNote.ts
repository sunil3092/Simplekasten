// The note most recently opened on the note screen. The graph tab reads it to
// offer desktop's "This note" scope — on desktop the graph opens over the
// active note; on mobile the graph is its own tab, so it needs to be told.
// In memory only: a fresh launch starts with the whole-vault graph.
let lastNoteId: string | null = null;

export function setLastNote(id: string | null) {
  lastNoteId = id;
}

export function getLastNote(): string | null {
  return lastNoteId;
}
