// User-facing strings both apps show word for word. Anything that says the
// same thing on desktop and mobile lives here so the two can't drift.
export const COPY = {
  emptyVault: "Your vault is empty — create the first note to get started.",
  emptyGraph: "Nothing to graph yet.",
  editorPlaceholder: "Start writing… type [[ to link to another note",
  titlePlaceholder: "Untitled",
  noLinks: "Link to notes with [[wiki-links]].",
  noBacklinks: "Nothing links here yet.",
  searchPlaceholder: "Search notes, or type a new title…",
  searching: "Searching…",
  createNote: (title: string) => `Create “${title}”`,
  newNote: "New note",
  mapsOfContent: "Maps of content",
  linkedMentions: "Linked mentions",
  attachments: "Attachments",
  saving: "Saving…",
  saved: "Saved",
  deleteNoteTitle: "Delete this note?",
  deleteNoteBody: (title: string) =>
    `“${title || "Untitled"}” will disappear from your notes, search and graph. Links to it will show as unresolved. The file stays on disk, marked deleted.`,
  deleteAttachment: "Remove attachment",
  noteCount: (count: number, tag: string | null) => `${count} note${count === 1 ? "" : "s"}${tag ? ` · #${tag}` : ""}`,
} as const;
