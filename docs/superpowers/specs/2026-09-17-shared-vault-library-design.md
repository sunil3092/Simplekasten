# Shared vault library — design

## Context

Simplekasten is moving from "every client talks to the Express + tRPC API"
toward local-first: Desktop and Mobile should each work against a vault on
their own device's filesystem, with no server required for core note-taking.
The server (`apps/api` + `packages/db`, Postgres/Auth.js/JWT) stays in the
repo as the dormant future home of an opt-in cross-device sync feature — it
is not being removed or changed by this work.

This is the first of four sequenced sub-projects toward that goal:

1. **Shared vault library** (this spec)
2. Desktop's own standalone renderer (replacing its dependency on `apps/web`)
3. Mobile's rewiring onto the shared library (including attachments)
4. Removing `apps/web`; archiving `apps/api`/`packages/db` as dormant

Only (1) is specified and planned here. (2)–(4) get their own spec/plan
later, once this library exists.

`packages/local-engine` already exists and already does most of this: pure
functions operating over a `FileSystemAdapter` interface, explicitly
designed (per its own doc comment) so both a Node `fs` adapter (desktop) and
an `expo-file-system` adapter (mobile) can back the same vault format. This
spec extends it to be feature-complete for both platforms, and moves the
Node adapter (currently duplicated inside `apps/desktop`) into the package.

## Goals

- `packages/local-engine` becomes the one library both Desktop and Mobile
  import directly for all vault operations — notes, tags, links, graph,
  search, and (new) attachments.
- Add a working `expo-file-system`-backed adapter so Mobile can use the
  engine at all (it currently has none).
- Move the Node `fs` adapter out of `apps/desktop` and into the package, so
  adapters live next to the engine they implement instead of being
  duplicated per app.
- Add attachment support (photos, voice notes) to the vault format, since
  Mobile's attachment feature currently depends entirely on server upload
  and has no local-first equivalent.

## Non-goals

- No React/TanStack Query layer ships in this package. Each app wires the
  plain async functions into its own state management.
- No changes to `apps/web`, `apps/desktop`'s renderer, or `apps/mobile`'s UI
  — this spec only builds the library those changes will later consume.
- No changes to `apps/api` / `packages/db`.
- No arbitrary-folder picking on Mobile (see "Vault location" below).

## Package layout

```
packages/local-engine/src/
  types.ts          # + Attachment type
  note-file.ts       # + attachmentIds in frontmatter
  vault.ts            # + attachment CRUD functions
  adapters/
    node.ts           # moved from apps/desktop/fsAdapter.js
    expo.ts            # new
  index.ts             # + export adapters
```

`packages/core` is unchanged — its shared types/schemas/slug/link parsing
already have no platform-specific code and need nothing new for this work.

## Data model

### Attachment type (`types.ts`)

```ts
export interface Attachment {
  id: string;
  noteId: string;
  kind: "photo" | "voice";
  filename: string;    // original filename, for display
  mimeType: string;
  createdAt: string;
}
```

`kind` is derived from `mimeType` the same way the API does today
(`image/*` → `"photo"`, `audio/*` → `"voice"`; anything else is rejected) —
kept as a small helper in `vault.ts`, not part of the public type.

### On disk

```
<vault-root>/
  notes/
    <id>.md
  attachments/
    <attachmentId>-<filename>
```

Each note's YAML frontmatter gains an `attachmentIds: string[]` field
(default `[]`, omitted when empty — same convention `deletedAt` already
follows). Attachment metadata (`kind`, `mimeType`, `createdAt`, `filename`)
is stored in a single `attachments/manifest.json` — a flat map of
`attachmentId -> Attachment` — rather than per-file sidecars, since it's
small, read-once-per-vault-load data and a single file avoids an N-file
readdir+parse pass on every attachment list/lookup. Loaded and rewritten
wholesale, same as every other vault read/write in this engine.

## New engine functions (`vault.ts`)

All take `(fs: FileSystemAdapter, ...)` like every existing function:

- `createAttachment(fs, { noteId, sourcePath, filename, mimeType }): Promise<Attachment>`
  — validates `mimeType` maps to a `kind`, copies the source file into
  `attachments/` via the adapter's `copyFile`, appends to the manifest, adds
  the new id to the note's `attachmentIds`.
- `listAttachments(fs, noteId): Promise<Attachment[]>`
- `deleteAttachment(fs, id): Promise<void>` — removes the file, the manifest
  entry, and the id from its note's `attachmentIds`.
- `getAttachmentFilePath(fs, id): Promise<string>` — resolves an attachment
  to a path/URI the UI layer can hand to an `<img>` / audio player. Resolving
  this is platform-specific (desktop needs an absolute path or `file://`
  URL; Expo needs its own URI scheme), so this returns whatever the adapter
  considers a "readable path" — each adapter documents what it returns.

`NoteDetail` (returned by `getNoteById`) gains an `attachments: Attachment[]`
field, populated the same way `backlinks`/`contents` already are.

## `FileSystemAdapter` changes

One new method:

```ts
copyFile(sourcePath: string, destPath: string): Promise<void>;
```

Both adapters implement this as a native file copy (`fs.copyFile` /
`expo-file-system`'s `copyAsync`) so attachment binaries never round-trip
through a JS string — important for multi-MB photos and voice memos.
`sourcePath` is whatever URI the platform's picker (file dialog on desktop,
`expo-image-picker`/`expo-av` on mobile) already hands back; the adapter
doesn't need to know where it came from.

## Adapters

### `adapters/node.ts`

Direct move of today's `apps/desktop/fsAdapter.js` into the package, with a
`copyFile` method added (`fs.copyFileSync` wrapped in a promise, consistent
with the adapter's existing sync-under-the-hood style). `apps/desktop` will
import `createNodeFsAdapter` from `@simplekasten/local-engine` instead of
its local file once its renderer work (sub-project 2) touches that wiring;
until then the package export exists but nothing consumes it yet.

### `adapters/expo.ts`

New. Implements the same interface using `expo-file-system`:

- `listFiles`/`readFile`/`writeFile`/`deleteFile`/`exists`/`ensureDir` map
  directly onto `FileSystem.readDirectoryAsync`, `readAsStringAsync`,
  `writeAsStringAsync`, `deleteAsync`, `getInfoAsync`, `makeDirectoryAsync`.
- `copyFile` maps to `FileSystem.copyAsync`.
- Takes a `vaultRoot` at construction, exactly like the Node adapter, so the
  engine code stays 100% adapter-agnostic.

## Vault location

- **Desktop**: unchanged — user-chosen folder anywhere on disk, via the
  existing `chooseVaultFolder`/multi-vault flow in `apps/desktop`.
- **Mobile**: one fixed vault directory under
  `FileSystem.documentDirectory + "vault/"` — no folder picker. iOS/Android
  don't offer a comparable "pick any folder to write into" primitive the way
  a desktop OS does, and no other requirement in this project calls for
  multi-vault on mobile.

## Testing

- Extend `packages/local-engine`'s existing vitest suite (it already has a
  memory-backed `FileSystemAdapter` test helper) to cover: attachment
  create/list/delete, the manifest round-trip, and `attachmentIds` surviving
  a note update.
- `adapters/node.ts`: a small test against a real temp directory (as the
  existing desktop adapter presumably already gets exercised through — add
  direct unit coverage here since it now lives in a shared, tested package).
- `adapters/expo.ts`: unit tests with `expo-file-system` mocked (it isn't
  runnable outside a React Native runtime) — verify each method maps to the
  right `expo-file-system` call with the right arguments.

## Open items for later sub-projects (explicitly not decided here)

- How Desktop's new renderer and Mobile's UI each present attachments
  (thumbnails, playback) — consumes `getAttachmentFilePath`, doesn't affect
  this spec.
- Whether/how `apps/api`'s `Attachment` Prisma model and upload routes get
  archived — deferred to sub-project 4.
