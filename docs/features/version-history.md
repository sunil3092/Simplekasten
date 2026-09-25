# Feature: Version History / Diffing

**Status:** shipped 2026-09-25.
**Why:** gap analysis item #8. Notion, Obsidian Sync, and Roam all offer
some form of "what did this note look like an hour ago" recovery — the
one safety net a plain-file, no-backend vault doesn't get for free the way
a database-backed app would. Medium effort, no external product decision
needed (unlike AI features, the clipper, or sync), so it's the next
candidate now that Daily Notes, Templates, Spaced Repetition, and the
Command Palette are all shipped.

## Scope decision

Track **content history only**, not every field. A note's type, tags, and
links are all derived from content or metadata that isn't worth diffing;
title is captured alongside each snapshot for context (so a renamed note's
history still reads sensibly) but a title-only edit doesn't by itself
create a new version — only a content change does. This keeps the feature
answering the one question it exists for ("what did the text used to
say"), not turning into a full audit log.

Snapshots are **coalesced**, not taken on every autosave tick. `updateNote`
already fires on a 600ms debounce while typing — snapshotting on every one
of those would flood a note's history with near-duplicate versions from a
single sitting. Instead, a new version is only written when a content
change lands **and** the note's last snapshot (if any) is more than 5
minutes old. This produces roughly "one version per five minutes of active
editing," which is what "look at an hour ago" actually needs, without the
engine needing to know anything about typing pauses or explicit saves (the
whole app is autosave-only; there's no "save" action to hook instead).

History is capped at **100 versions per note**, oldest pruned first — a
personal Zettelkasten note being edited daily for a year is nowhere near
that cap under the 5-minute coalescing window, so this is a safety bound
against pathological cases, not a real-world limit.

## Data model (`packages/local-engine`)

Snapshots live outside `notes/`, one small file per version, so an
ordinary note's own file format (and every existing `note-file.ts`
round-trip test) is untouched:

```
<vault>/.history/<noteId>/<versionId>.md
```

`versionId` is `${Date.now()}-${random suffix}` (same shape as note ids'
`generateId()`, so it's both unique and lexically sortable by creation
time — no separate index file needed to answer "newest first"). Each
snapshot file is a minimal frontmatter + body, parsed by a new
`history-file.ts` (deliberately not reusing `note-file.ts`'s
`parseNoteFile`/`serializeNoteFile`, which require fields — `zettelId`,
`type`, `attachmentIds`, the review-queue group — that don't apply to a
historical snapshot):

```
---
title: Atomicity
---
Notes should be atomic. See [[Zettelkasten]].
```

```ts
// packages/local-engine/src/history-file.ts
export interface HistorySnapshot { title: string; content: string; }
export function serializeHistorySnapshot(s: HistorySnapshot): string
export function parseHistorySnapshot(raw: string): HistorySnapshot
```

## Diffing (`packages/local-engine/src/diff.ts`)

A pure, I/O-free line diff — same "algorithm gets its own file and its own
focused unit tests before any I/O touches it" precedent `srs.ts` set for
spaced repetition:

```ts
export type DiffOp = "equal" | "insert" | "delete";
export interface DiffLine { op: DiffOp; text: string; }

export function diffLines(oldText: string, newText: string): DiffLine[]
```

Classic LCS-based line diff (dynamic programming over lines, not
characters) — more than adequate for note-sized text, and it keeps the
implementation to a couple dozen lines with no dependency. Both apps
import it directly (it needs no `FileSystemAdapter`, so no IPC round trip
is needed on desktop either).

## `packages/local-engine/src/vault.ts` — new functions

```ts
export interface NoteVersion { id: string; createdAt: string; title: string; }

export async function listNoteVersions(fs: FileSystemAdapter, noteId: string): Promise<NoteVersion[]>
// newest first, parsed from each snapshot file's id/frontmatter

export async function getNoteVersion(fs: FileSystemAdapter, noteId: string, versionId: string): Promise<HistorySnapshot & { createdAt: string }>

export async function restoreNoteVersion(fs: FileSystemAdapter, noteId: string, versionId: string): Promise<VaultNote>
// Always snapshots the CURRENT state first, unconditionally (restoring is
// a deliberate, infrequent action, not an autosave tick, so the 5-minute
// coalescing window doesn't apply here) — so restoring is itself
// reversible, then overwrites title/content from the target snapshot and
// bumps updatedAt.
```

`updateNote` gains the coalescing snapshot write: before applying a
content change, if the note's last version is missing or more than 5
minutes old, it writes one snapshot of the pre-edit `{ title, content }`,
then prunes anything past the 100-version cap.

## Desktop UI (`apps/desktop`)

- IPC (`main.js`/`preload.js`/`vaultClient.ts`) gains `listNoteVersions`,
  `getNoteVersion`, `restoreNoteVersion`. `diffLines` is imported directly
  from `@simplekasten/local-engine` in the renderer — it's pure, so it
  needs no IPC round trip.
- A new `history` icon in `packages/core/src/icons.ts` (clock with a
  counter-clockwise arrow).
- Note header: a `history` `IconButton` ("Version history"), next to the
  existing template/review/attach/delete row, opening a new
  `VersionHistoryModal.tsx` — a dialog (like `TemplatesModal`, not a
  full-screen overlay like `GraphView`/`ReviewSession`: this is an
  occasional lookup, not a primary mode). It lists versions by timestamp
  (`toLocaleString()`, no new date library); selecting one renders
  `diffLines(version.content, currentContent)` as coloured
  added/removed/unchanged lines, with a "Restore this version" button
  that asks for confirmation (`ConfirmDialog`, same pattern delete
  already uses) before calling `restoreNoteVersion` and refreshing the
  open note.

## Mobile UI (`apps/mobile`)

- `src/lib/vault.ts` gains the same three calls.
- Note screen header: a `history` icon opening a new `app/history.tsx`
  screen (`?noteId=` param), listing versions the same way. Tapping one
  shows its content read-only — no diff view on mobile (matches
  Templates' precedent: mobile is a consumer of a desktop-authored,
  richer feature, not a second full implementation) — with a "Restore"
  button behind an `Alert.alert` confirmation.

## Testing plan

- `packages/local-engine`: `diff.ts` gets its own focused unit tests
  (identical text, pure insert, pure delete, mixed changes, empty inputs).
  `vault.test.ts` gets a new "version history" describe block: the
  5-minute coalescing window (using `vi.useFakeTimers()`), the 100-version
  prune, `restoreNoteVersion`'s always-snapshot-first behavior and its
  actual content/title restore, and title-only edits not creating a
  version.
- `apps/desktop`: extend `e2e/bridge.ts` with version fixtures; a new
  `version-history.e2e.ts` covering opening the panel, seeing a diff, and
  restoring a version updates the open note.
- `apps/mobile`: `tsc` typecheck, then the same visual-smoke-through-Expo-web
  process every other feature here has used.

## Where this left off

Shipped 2026-09-25, implemented close to spec with one deviation:

- **local-engine**: `diff.ts` (pure LCS line diff, 7 unit tests) and
  `history-file.ts` (minimal snapshot format, 4 round-trip tests) came
  first, then `vault.ts` gained `listNoteVersions`/`getNoteVersion`/
  `restoreNoteVersion` plus the coalescing snapshot write inside
  `updateNote`. Deviation from the original sketch: `HistorySnapshot` (and
  its on-disk frontmatter) carries `createdAt` directly, rather than
  encoding the timestamp in the version id and parsing it back out —
  simpler and more explicit, and `versionId` just reuses the existing
  `generateId()` helper instead of a bespoke format. 9 new tests cover the
  5-minute coalescing window and 100-version cap (using
  `vi.useFakeTimers()`), title-only edits not versioning, and
  `restoreNoteVersion`'s always-snapshot-first behavior.
- **Desktop**: IPC wired end-to-end, a `history` icon added, and
  `VersionHistoryModal.tsx` built as a dialog (not a full-screen overlay —
  looking up an old version is an occasional lookup) listing versions by
  timestamp with `diffLines` rendered as coloured added/removed lines and
  a confirm-gated restore. `e2e/bridge.ts` extended with version fixtures;
  `version-history.e2e.ts` covers the diff view and a full restore
  round-trip. 26 desktop e2e specs total, all green.
- **Mobile**: `src/lib/vault.ts` gained the same three calls, the note
  screen header got a matching `history` icon, and a new `app/history.tsx`
  screen lists versions with a read-only content preview per version (no
  diff view, matching Templates' precedent of mobile being a simpler
  consumer) and a Restore action behind an `Alert.alert` confirmation.
  Verified via `tsc` (clean); the screen's actual version list/restore
  flow inherits the same `expo-file-system` web-target limitation every
  note-touching mobile screen here has (`review.tsx` included) — real
  interaction needs a device/emulator. The vault tab was re-screenshotted
  to confirm no regression from adding the new route.

Full-suite final check: 170 unit tests (desktop 32, core 19, local-engine
87, themes 32) + 26 desktop e2e tests, all green; `tsc --noEmit` clean
across all five workspaces.
