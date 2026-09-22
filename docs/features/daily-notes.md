# Feature: Daily Notes / Journal

**Status:** rewritten 2026-09-22 for the local-engine architecture (the app
moved from a Postgres+tRPC backend to a local-first file vault after this
spec's first draft — see `docs/ROADMAP.md`'s architecture note). Ready to
implement.
**Why:** every modern PKM app (Roam, Logseq, Obsidian, Tana) opens to a
"today" page by default — it's the low-friction capture surface for fleeting
thoughts before they're refiled into permanent notes. Simplekasten currently
has no such entry point; creating a note always means typing a title first.

## Data model (`packages/local-engine`)

A daily note *is* a `VaultNote` — same markdown file, same frontmatter
format — with two additions:

`packages/core/src/schemas.ts`:
```ts
export const noteTypeSchema = z.enum(["fleeting", "literature", "permanent", "structure", "daily"]);
```

`packages/local-engine/src/types.ts` — `VaultNote` gains:
```ts
noteDate: string | null; // "YYYY-MM-DD", set only when type === "daily"; the calendar day this note represents
```

`packages/local-engine/src/note-file.ts` — `parseNoteFile`/`serializeNoteFile`
read/write `noteDate` from/to frontmatter exactly like `deletedAt` (omit the
key entirely when null, so ordinary notes' frontmatter is unchanged).

`packages/themes/src/noteTypes.ts` — `NOTE_TYPES` gains a `daily` entry
(badge colours: reuse `accent`/`accentSoft`/`accentInk` like `permanent`,
since a daily note is a first-class note, not a lesser one — pick something
visually distinct in practice, e.g. `accent2` family, when implementing).

## `packages/local-engine/src/vault.ts` — two new functions

```ts
// Get-or-create by calendar date. The engine has no server round trip to
// save, so "find, then create if missing" is just two in-process calls —
// no separate mutation-vs-query split like the old tRPC design had.
export async function getOrCreateDailyNote(fs: FileSystemAdapter, date: string): Promise<VaultNote> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  const existing = notes.find((n) => n.noteDate === date);
  if (existing) return existing;

  const now = new Date().toISOString();
  const note: VaultNote = {
    id: generateId(),
    zettelId: nextZettelId(notes),
    title: formatHumanDate(date), // "September 22, 2026"
    content: "",
    type: "daily",
    noteDate: date,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    attachmentIds: [],
  };
  await fs.ensureDir(NOTES_DIR);
  await fs.writeFile(noteFilePath(note.id), serializeNoteFile(note));
  return note;
}

// For the Journal sidebar section — most recent daily notes, newest first.
export async function listDailyNotes(fs: FileSystemAdapter, limit = 30): Promise<NoteListItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt && n.type === "daily");
  return notes
    .sort((a, b) => (b.noteDate ?? "").localeCompare(a.noteDate ?? ""))
    .slice(0, limit)
    .map(({ id, zettelId, title, type, updatedAt }) => ({ id, zettelId, title, type, updatedAt }));
}
```

`date` is always supplied by the caller (client-local `YYYY-MM-DD`), never
computed inside the engine — the engine has no notion of the user's
timezone, and "today" is inherently a client-local concept. Both apps
compute it the same way: `new Date().toLocaleDateString("en-CA")` (a locale
trick that happens to format as `YYYY-MM-DD` in local time, not a hardcoded
region).

No uniqueness constraint to enforce at the storage layer beyond the
find-before-create in `getOrCreateDailyNote` itself — consistent with
`generateId`'s existing comment ("good enough for a single local writer,
there's nothing else to collide with").

## Desktop UI (`apps/desktop`, Next.js renderer inside Electron)

- `src/lib/vaultClient.ts` gains `getOrCreateDailyNote(date)` and
  `listDailyNotes(limit)`, wired the same way every other vault call is
  (IPC to the main process, which holds the Node `FileSystemAdapter`).
- Sidebar (`src/app/page.tsx`): a "Today" button (new `calendar` icon in
  `packages/core/src/icons.ts` → `src/components/icons.tsx`) above "New
  note", using the existing `Button` primitive from `ui.tsx`. Calls
  `getOrCreateDailyNote(todayLocal())` and opens the result like any other
  note.
- New "Journal" sidebar section (below Maps of Content), populated from
  `listDailyNotes`, mirroring the existing Maps-of-Content section's
  markup/pattern.
- Note header: daily notes show a `daily` type badge (from `NOTE_TYPES`,
  automatic once that entry exists) plus Prev/Next-day chevron buttons that
  call `getOrCreateDailyNote(date ± 1 day)` — lets a user scroll through
  their journal like Roam/Logseq, creating empty days on demand.
- Keyboard shortcut: extend the existing `Cmd/Ctrl+K` key-handling effect
  with `Cmd/Ctrl+J` for "open today" (unclaimed in the current app).

## Mobile UI (`apps/mobile`)

- `src/lib/vault.ts` gains the same two calls, backed by the
  `expo-file-system` adapter.
- Vault tab header: a "Today" pill next to "New note" — same
  get-or-create-then-navigate pattern used for creating any note today.
- Note screen: when `note.type === "daily"`, show Prev/Next-day chevrons in
  the header row (mirrors desktop); tapping calls the same function with an
  adjusted date.
- No separate Journal list screen for v1 — mobile's screen real estate
  favors the single Today entry point plus prev/next navigation from within
  a daily note. A full journal browser can follow once the pattern proves
  useful.

## Testing plan

- `packages/core`: unit test `noteTypeSchema` accepts `"daily"`.
- `packages/local-engine`: unit tests for `getOrCreateDailyNote` (first call
  creates, second call with the same date returns the same note — no
  duplicate; a different date creates a second note) and `listDailyNotes`
  (date-descending order, respects `limit`, excludes non-daily and deleted
  notes) — same style as the existing `vault.test.ts`.
- `apps/desktop`: extend `e2e/bridge.ts`'s stub with the two new calls; add
  a spec exercising "Today" creates/reopens a note, Next-day creates
  tomorrow's, both types render the `daily` badge from the shared palette
  (matching the existing palette-conformance spec's intent).
- `apps/mobile`: `tsc` typecheck, then manual verification through Expo
  (per this repo's established pattern — no iOS/Android simulator in this
  sandbox, so Expo's web target or a description of the manual walkthrough
  stands in when a real device/emulator isn't available).

## Status: shipped 2026-09-22

Implemented as specced above. `NoteDetail` also gained `noteDate` (not
originally listed in this spec — needed so the UI can compute prev/next-day
without re-parsing the human-readable title) — populated in
`getNoteById`. See `docs/ROADMAP.md`'s status table for verification
details (115 unit tests, 15 desktop e2e tests, mobile typecheck + visual
smoke test).
