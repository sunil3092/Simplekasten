# Shared Vault Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `packages/local-engine` a feature-complete, adapter-complete vault library — attachments included — that both Desktop and (later) Mobile import directly for all vault operations, with the Node filesystem adapter moved out of `apps/desktop` and into the package alongside a new Expo adapter.

**Architecture:** `packages/local-engine` already exposes pure functions (`createNote`, `listNotes`, `getGraph`, etc.) operating over a `FileSystemAdapter` interface, with an in-memory adapter for tests. This plan extends that interface with `copyFile`/`resolvePath`, adds attachment CRUD functions backed by a JSON manifest under `attachments/`, and adds two adapter implementations — `adapters/node.ts` (moved from `apps/desktop/fsAdapter.js`) and `adapters/expo.ts` (new) — each exported as its own package subpath so a Node-only consumer (Electron's main process) never pulls in `expo-file-system` and vice versa.

**Tech Stack:** TypeScript, vitest, `js-yaml` (existing), Node's built-in `fs`, `expo-file-system` (new, mobile-only).

**Spec:** `docs/superpowers/specs/2026-09-17-shared-vault-library-design.md`

## Global Constraints

- Node.js >= 22 (repo-wide `engines` requirement).
- TypeScript `strict: true` (from `tsconfig.base.json`, which every package extends).
- No React or TanStack Query code ships in this package — plain async functions only.
- No changes to `apps/web`, `apps/desktop`'s renderer/UI, or `apps/mobile`'s UI/screens in this plan. The one exception is `apps/desktop/main.js`'s adapter import line (Task 3) — that's Electron main-process wiring, not renderer code, and it must change or `npm run dev:desktop` breaks once the adapter file it requires is deleted.
- No changes to `apps/api` or `packages/db`.
- Attachment `mimeType` maps to `kind`: `image/*` → `"photo"`, `audio/*` → `"voice"`, anything else is rejected — matching `apps/api/src/attachments.ts`'s existing rule.
- Mobile gets one fixed vault directory (no folder picker); this plan only makes the adapter generic enough to support that — actually wiring `apps/mobile` up to it is a later sub-project.

---

### Task 1: Add `attachmentIds` to the note file format

**Files:**
- Modify: `packages/local-engine/src/types.ts:20-28` (`VaultNote` interface)
- Modify: `packages/local-engine/src/note-file.ts` (`parseNoteFile`, `serializeNoteFile`)
- Modify: `packages/local-engine/src/note-file.test.ts`
- Modify: `packages/local-engine/src/vault.ts` (`createNote`'s literal)

**Interfaces:**
- Produces: `VaultNote.attachmentIds: string[]` — every `VaultNote` (returned by `createNote`/`updateNote`, parsed by `parseNoteFile`) now carries this field. Task 2 relies on it.

- [ ] **Step 1: Write the failing test**

Add to `packages/local-engine/src/note-file.test.ts` (inside the existing `describe` block, and add `attachmentIds: []` to the two existing `VaultNote` fixtures so they still type-check against the field you're about to add):

```ts
  it("round-trips attachmentIds, omitting the field entirely when empty", () => {
    const withAttachments: VaultNote = {
      id: "att1",
      zettelId: "3",
      title: "With photo",
      type: "fleeting",
      content: "body",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      attachmentIds: ["a1", "a2"],
    };

    const raw = serializeNoteFile(withAttachments);
    expect(raw).toContain("attachmentIds");
    expect(parseNoteFile(raw, withAttachments.id)).toEqual(withAttachments);

    const withoutAttachments: VaultNote = { ...withAttachments, id: "att2", attachmentIds: [] };
    const rawEmpty = serializeNoteFile(withoutAttachments);
    expect(rawEmpty).not.toContain("attachmentIds");
    expect(parseNoteFile(rawEmpty, withoutAttachments.id)).toEqual(withoutAttachments);
  });
```

Also add `attachmentIds: []` to the two existing fixtures in that file (the `"serializes then parses back..."` and `"round-trips a soft-deleted note's deletedAt"` tests) so every `VaultNote` literal in the file is complete.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @simplekasten/local-engine -- note-file`
Expected: FAIL — `parsed.attachmentIds` is `undefined`, not `["a1", "a2"]` / `[]`.

- [ ] **Step 3: Implement**

In `packages/local-engine/src/types.ts`, add to `VaultNote` (after `deletedAt: string | null;`):

```ts
  attachmentIds: string[];
```

In `packages/local-engine/src/note-file.ts`, in `parseNoteFile`, add to the returned object (after `deletedAt: ...`):

```ts
    attachmentIds: Array.isArray(frontmatter.attachmentIds) ? frontmatter.attachmentIds.map(String) : [],
```

In `serializeNoteFile`, after the existing `if (note.deletedAt) frontmatter.deletedAt = note.deletedAt;` line, add:

```ts
  if (note.attachmentIds.length > 0) frontmatter.attachmentIds = note.attachmentIds;
```

In `packages/local-engine/src/vault.ts`, in `createNote`, add `attachmentIds: [],` to the `note: VaultNote = { ... }` literal (after `deletedAt: null,`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @simplekasten/local-engine`
Expected: PASS — all tests in the package, including the new one.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck -w @simplekasten/local-engine`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/local-engine/src/types.ts packages/local-engine/src/note-file.ts packages/local-engine/src/note-file.test.ts packages/local-engine/src/vault.ts
git commit -m "Add attachmentIds to the vault note frontmatter format"
```

---

### Task 2: Add attachment support to the vault engine

**Files:**
- Modify: `packages/local-engine/src/types.ts` (`FileSystemAdapter`, new `Attachment` type, `NoteDetail`)
- Modify: `packages/local-engine/src/memory-fs.test-helper.ts`
- Modify: `packages/local-engine/src/vault.ts`
- Modify: `packages/local-engine/src/vault.test.ts`

**Interfaces:**
- Consumes: `VaultNote.attachmentIds` (Task 1).
- Produces:
  - `FileSystemAdapter.copyFile(sourcePath: string, destPath: string): Promise<void>`
  - `FileSystemAdapter.resolvePath(path: string): string`
  - `Attachment { id, noteId, kind: "photo" | "voice", filename, mimeType, createdAt }`
  - `createAttachment(fs, { noteId, sourcePath, filename, mimeType }): Promise<Attachment>`
  - `listAttachments(fs, noteId): Promise<Attachment[]>`
  - `deleteAttachment(fs, id): Promise<void>`
  - `getAttachmentFilePath(fs, id): Promise<string>`
  - `NoteDetail.attachments: Attachment[]`
  All of the above are consumed by Task 3/4's adapter tests and by later sub-projects (desktop/mobile UI wiring), not by any other task in this plan.

- [ ] **Step 1: Write the failing tests**

In `packages/local-engine/src/vault.test.ts`, add `createAttachment, deleteAttachment, getAttachmentFilePath, listAttachments` to the existing import from `"./vault"`, and add this new `describe` block at the end of the file:

```ts
describe("attachments", () => {
  it("creates an attachment, links it to the note, and lists it back", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With photo", content: "" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(attachment.kind).toBe("photo");
    expect(await listAttachments(fs, note.id)).toEqual([attachment]);

    const detail = await getNoteById(fs, note.id);
    expect(detail?.attachments).toEqual([attachment]);
  });

  it("classifies audio mime types as voice attachments", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With voice memo", content: "" });
    await fs.writeFile("incoming/memo.m4a", "fake-audio-bytes");

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/memo.m4a",
      filename: "memo.m4a",
      mimeType: "audio/m4a",
    });

    expect(attachment.kind).toBe("voice");
  });

  it("rejects unsupported mime types", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "Target", content: "" });
    await fs.writeFile("incoming/doc.pdf", "fake-pdf-bytes");

    await expect(
      createAttachment(fs, {
        noteId: note.id,
        sourcePath: "incoming/doc.pdf",
        filename: "doc.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(/Unsupported attachment mime type/);
  });

  it("removes an attachment's file, manifest entry, and note reference on delete", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With photo", content: "" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");
    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    await deleteAttachment(fs, attachment.id);

    expect(await listAttachments(fs, note.id)).toEqual([]);
    expect(await fs.exists(`attachments/${attachment.id}-photo.jpg`)).toBe(false);
    await expect(getAttachmentFilePath(fs, attachment.id)).rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @simplekasten/local-engine -- vault`
Expected: FAIL — `createAttachment` etc. are not exported from `./vault`.

- [ ] **Step 3: Extend `FileSystemAdapter` and the in-memory test helper**

In `packages/local-engine/src/types.ts`, add two methods to `FileSystemAdapter` (after `ensureDir(path: string): Promise<void>;`):

```ts
  /** Copies a file from an arbitrary source path/URI to `destPath` (vault-relative), creating parent directories as needed. */
  copyFile(sourcePath: string, destPath: string): Promise<void>;
  /** Resolves a vault-relative path to an absolute path/URI a UI layer can use directly (e.g. an <img src> or audio player). */
  resolvePath(path: string): string;
```

Add the `Attachment` interface (anywhere after the imports, e.g. right after `VaultNote`):

```ts
export interface Attachment {
  id: string;
  noteId: string;
  kind: "photo" | "voice";
  filename: string;
  mimeType: string;
  createdAt: string;
}
```

Add `attachments: Attachment[];` to `NoteDetail` (after `tagNames: string[];`).

In `packages/local-engine/src/memory-fs.test-helper.ts`, add to the returned object (after `async ensureDir() { ... }`):

```ts
    async copyFile(source: string, dest: string) {
      const contents = files.get(source);
      if (contents === undefined) throw new Error(`ENOENT: ${source}`);
      files.set(dest, contents);
    },
    resolvePath(path: string) {
      return path;
    },
```

- [ ] **Step 4: Implement the attachment functions in `vault.ts`**

Update the `import type { ... } from "./types";` at the top of `packages/local-engine/src/vault.ts` to include `Attachment`:

```ts
import type {
  Attachment,
  CreateNoteInput,
  FileSystemAdapter,
  GraphData,
  LinkRef,
  NoteDetail,
  NoteListItem,
  SearchResultItem,
  TagItem,
  UpdateNoteInput,
  VaultNote,
} from "./types";
```

In `getNoteById`, add `attachments: await listAttachments(fs, id),` to the returned object (after `tagNames,`).

Append to the end of the file:

```ts
const ATTACHMENTS_DIR = "attachments";
const MANIFEST_PATH = `${ATTACHMENTS_DIR}/manifest.json`;

function kindForMimeType(mimeType: string): "photo" | "voice" | null {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("audio/")) return "voice";
  return null;
}

function attachmentFilename(attachment: Pick<Attachment, "id" | "filename">): string {
  return `${attachment.id}-${attachment.filename}`;
}

async function loadManifest(fs: FileSystemAdapter): Promise<Record<string, Attachment>> {
  if (!(await fs.exists(MANIFEST_PATH))) return {};
  const raw = await fs.readFile(MANIFEST_PATH);
  return JSON.parse(raw) as Record<string, Attachment>;
}

async function saveManifest(fs: FileSystemAdapter, manifest: Record<string, Attachment>): Promise<void> {
  await fs.ensureDir(ATTACHMENTS_DIR);
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export interface CreateAttachmentInput {
  noteId: string;
  sourcePath: string;
  filename: string;
  mimeType: string;
}

export async function createAttachment(fs: FileSystemAdapter, input: CreateAttachmentInput): Promise<Attachment> {
  const kind = kindForMimeType(input.mimeType);
  if (!kind) {
    throw new Error(`Unsupported attachment mime type "${input.mimeType}" — only image/* and audio/* are supported`);
  }

  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === input.noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${input.noteId}" not found`);

  const attachment: Attachment = {
    id: generateId(),
    noteId: input.noteId,
    kind,
    filename: input.filename,
    mimeType: input.mimeType,
    createdAt: new Date().toISOString(),
  };

  await fs.ensureDir(ATTACHMENTS_DIR);
  await fs.copyFile(input.sourcePath, `${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);

  const manifest = await loadManifest(fs);
  manifest[attachment.id] = attachment;
  await saveManifest(fs, manifest);

  await fs.writeFile(
    noteFilePath(note.id),
    serializeNoteFile({
      ...note,
      attachmentIds: [...note.attachmentIds, attachment.id],
      updatedAt: new Date().toISOString(),
    }),
  );

  return attachment;
}

export async function listAttachments(fs: FileSystemAdapter, noteId: string): Promise<Attachment[]> {
  const manifest = await loadManifest(fs);
  return Object.values(manifest)
    .filter((a) => a.noteId === noteId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteAttachment(fs: FileSystemAdapter, id: string): Promise<void> {
  const manifest = await loadManifest(fs);
  const attachment = manifest[id];
  if (!attachment) throw new Error(`Attachment "${id}" not found`);

  delete manifest[id];
  await saveManifest(fs, manifest);
  await fs.deleteFile(`${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);

  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === attachment.noteId);
  if (note) {
    await fs.writeFile(
      noteFilePath(note.id),
      serializeNoteFile({
        ...note,
        attachmentIds: note.attachmentIds.filter((attachmentId) => attachmentId !== id),
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}

export async function getAttachmentFilePath(fs: FileSystemAdapter, id: string): Promise<string> {
  const manifest = await loadManifest(fs);
  const attachment = manifest[id];
  if (!attachment) throw new Error(`Attachment "${id}" not found`);
  return fs.resolvePath(`${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -w @simplekasten/local-engine`
Expected: PASS — all tests, including the four new ones.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w @simplekasten/local-engine`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/local-engine/src/types.ts packages/local-engine/src/memory-fs.test-helper.ts packages/local-engine/src/vault.ts packages/local-engine/src/vault.test.ts
git commit -m "Add attachment support to the vault engine"
```

---

### Task 3: Move the Node filesystem adapter into the package

**Files:**
- Create: `packages/local-engine/src/adapters/node.ts`
- Create: `packages/local-engine/src/adapters/node.test.ts`
- Modify: `packages/local-engine/package.json`
- Modify: `apps/desktop/main.js:9`
- Delete: `apps/desktop/fsAdapter.js`

**Interfaces:**
- Consumes: `FileSystemAdapter` (Task 2's extended version, with `copyFile`/`resolvePath`).
- Produces: `createNodeFsAdapter(vaultRoot: string): FileSystemAdapter`, importable as `@simplekasten/local-engine/adapters/node`. Consumed by `apps/desktop/main.js` (this task) and by nothing else in this plan.

- [ ] **Step 1: Write the failing test**

Create `packages/local-engine/src/adapters/node.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNodeFsAdapter } from "./node";

describe("createNodeFsAdapter", () => {
  let vaultRoot: string;

  beforeEach(() => {
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "simplekasten-vault-"));
  });

  afterEach(() => {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  it("writes then reads a file, creating parent directories as needed", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);

    await adapter.writeFile("notes/abc.md", "hello");

    expect(await adapter.readFile("notes/abc.md")).toBe("hello");
    expect(fs.existsSync(path.join(vaultRoot, "notes", "abc.md"))).toBe(true);
  });

  it("lists only files, not subdirectories, and returns [] for a missing dir", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");
    await adapter.writeFile("notes/b.md", "b");
    await adapter.ensureDir("notes/nested");

    expect((await adapter.listFiles("notes")).sort()).toEqual(["a.md", "b.md"]);
    expect(await adapter.listFiles("missing")).toEqual([]);
  });

  it("deletes a file and reports existence correctly", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");

    expect(await adapter.exists("notes/a.md")).toBe(true);
    await adapter.deleteFile("notes/a.md");
    expect(await adapter.exists("notes/a.md")).toBe(false);
  });

  it("copies a file from an arbitrary source path into the vault, creating parent directories", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    const sourcePath = path.join(os.tmpdir(), `simplekasten-source-${Date.now()}.jpg`);
    fs.writeFileSync(sourcePath, "fake-image-bytes");

    await adapter.copyFile(sourcePath, "attachments/photo.jpg");

    expect(await adapter.readFile("attachments/photo.jpg")).toBe("fake-image-bytes");
    fs.rmSync(sourcePath, { force: true });
  });

  it("resolves a vault-relative path to an absolute path", () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    expect(adapter.resolvePath("notes/abc.md")).toBe(path.join(vaultRoot, "notes", "abc.md"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @simplekasten/local-engine -- adapters/node`
Expected: FAIL — `./node` module not found.

- [ ] **Step 3: Implement the adapter**

Create `packages/local-engine/src/adapters/node.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import type { FileSystemAdapter } from "../types";

/**
 * Node `fs`-backed implementation of `FileSystemAdapter` — every path the
 * engine passes in is relative to `vaultRoot`, resolved here against the
 * actual vault folder on disk. Runs in Electron's main process; the
 * renderer never touches `fs` directly (see apps/desktop/preload.js).
 */
export function createNodeFsAdapter(vaultRoot: string): FileSystemAdapter {
  const resolve = (relativePath: string) => path.join(vaultRoot, relativePath);

  return {
    async listFiles(dir) {
      const full = resolve(dir);
      if (!fs.existsSync(full)) return [];
      return fs.readdirSync(full).filter((name) => fs.statSync(path.join(full, name)).isFile());
    },
    async readFile(filePath) {
      return fs.readFileSync(resolve(filePath), "utf8");
    },
    async writeFile(filePath, contents) {
      const full = resolve(filePath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents, "utf8");
    },
    async deleteFile(filePath) {
      fs.rmSync(resolve(filePath), { force: true });
    },
    async exists(filePath) {
      return fs.existsSync(resolve(filePath));
    },
    async ensureDir(dir) {
      fs.mkdirSync(resolve(dir), { recursive: true });
    },
    async copyFile(sourcePath, destPath) {
      const full = resolve(destPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.copyFileSync(sourcePath, full);
    },
    resolvePath(relativePath) {
      return resolve(relativePath);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @simplekasten/local-engine`
Expected: PASS — all tests.

- [ ] **Step 5: Export the adapter as a package subpath**

In `packages/local-engine/package.json`, add an `"exports"` field (after `"types": "src/index.ts",`):

```json
  "exports": {
    ".": "./src/index.ts",
    "./adapters/node": "./src/adapters/node.ts"
  },
```

This is deliberately *not* re-exported from `src/index.ts` — that file stays platform-agnostic so importing the package's main entry point never pulls in Node's `fs` (or, after Task 4, `expo-file-system`) as a side effect.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w @simplekasten/local-engine`
Expected: PASS, no errors.

- [ ] **Step 7: Point `apps/desktop` at the package adapter and delete the duplicate**

In `apps/desktop/main.js:9`, change:

```js
const { createNodeFsAdapter } = require("./fsAdapter");
```

to:

```js
const { createNodeFsAdapter } = require("@simplekasten/local-engine/adapters/node");
```

Delete `apps/desktop/fsAdapter.js`.

- [ ] **Step 8: Verify the desktop app can still resolve the adapter**

Run (from `apps/desktop`): `node -e "require('tsx/cjs'); const { createNodeFsAdapter } = require('@simplekasten/local-engine/adapters/node'); console.log(typeof createNodeFsAdapter)"`
Expected: prints `function`.

If you have a display available, `npm run dev:desktop` and confirm the app still opens and lists/creates notes as before — the Electron main process wiring itself (IPC handlers, vault path, folder picker) is unchanged by this task, only the adapter's import source moved.

- [ ] **Step 9: Commit**

```bash
git add packages/local-engine/src/adapters/node.ts packages/local-engine/src/adapters/node.test.ts packages/local-engine/package.json apps/desktop/main.js
git rm apps/desktop/fsAdapter.js
git commit -m "Move the Node filesystem adapter into @simplekasten/local-engine"
```

---

### Task 4: Add the Expo filesystem adapter

**Files:**
- Create: `packages/local-engine/src/adapters/expo.ts`
- Create: `packages/local-engine/src/adapters/expo.test.ts`
- Modify: `packages/local-engine/package.json`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: `FileSystemAdapter` (Task 2).
- Produces: `createExpoFsAdapter(vaultRoot: string): FileSystemAdapter`, importable as `@simplekasten/local-engine/adapters/expo`. Not consumed anywhere in this plan — wiring `apps/mobile` up to it is a later sub-project. This task only needs it to exist, work, and be tested.

- [ ] **Step 1: Add the `expo-file-system` dependency**

Run: `npm install expo-file-system -w @simplekasten/mobile`

Open `apps/mobile/package.json`, find the version npm just added for `"expo-file-system"`, and add a matching entry to `packages/local-engine/package.json`'s `devDependencies` (needed so this package's own `typecheck` can resolve `expo-file-system`'s types), e.g.:

```json
    "expo-file-system": "<the version npm just added to apps/mobile/package.json>",
```

Also add to `packages/local-engine/package.json` (peer, not required — Node/Electron consumers of this package never need it installed):

```json
  "peerDependencies": {
    "expo-file-system": "*"
  },
  "peerDependenciesMeta": {
    "expo-file-system": { "optional": true }
  },
```

Run: `npm install` (from the repo root, to update the lockfile for both changes)

- [ ] **Step 2: Write the failing test**

Create `packages/local-engine/src/adapters/expo.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { files, dirs } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  dirs: new Set<string>(),
}));

vi.mock("expo-file-system", () => ({
  getInfoAsync: vi.fn(async (uri: string) => {
    if (files.has(uri)) return { exists: true, isDirectory: false, uri };
    if (dirs.has(uri)) return { exists: true, isDirectory: true, uri };
    return { exists: false, isDirectory: false, uri };
  }),
  readDirectoryAsync: vi.fn(async (uri: string) => {
    const prefix = `${uri}/`;
    const names = new Set<string>();
    for (const path of [...files.keys(), ...dirs.keys()]) {
      if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split("/")[0]);
    }
    return [...names];
  }),
  readAsStringAsync: vi.fn(async (uri: string) => {
    const contents = files.get(uri);
    if (contents === undefined) throw new Error(`ENOENT: ${uri}`);
    return contents;
  }),
  writeAsStringAsync: vi.fn(async (uri: string, contents: string) => {
    files.set(uri, contents);
  }),
  deleteAsync: vi.fn(async (uri: string) => {
    files.delete(uri);
  }),
  makeDirectoryAsync: vi.fn(async (uri: string) => {
    dirs.add(uri);
  }),
  copyAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    const contents = files.get(from);
    if (contents === undefined) throw new Error(`ENOENT: ${from}`);
    files.set(to, contents);
  }),
}));

import { createExpoFsAdapter } from "./expo";

describe("createExpoFsAdapter", () => {
  const vaultRoot = "file:///vault";

  beforeEach(() => {
    files.clear();
    dirs.clear();
  });

  it("writes then reads a file, creating parent directories as needed", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);

    await adapter.writeFile("notes/abc.md", "hello");

    expect(await adapter.readFile("notes/abc.md")).toBe("hello");
    expect(dirs.has(`${vaultRoot}/notes`)).toBe(true);
  });

  it("lists only files, not subdirectories, and returns [] for a missing dir", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");
    await adapter.writeFile("notes/b.md", "b");
    await adapter.ensureDir("notes/nested");

    expect((await adapter.listFiles("notes")).sort()).toEqual(["a.md", "b.md"]);
    expect(await adapter.listFiles("missing")).toEqual([]);
  });

  it("deletes a file and reports existence correctly", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");

    expect(await adapter.exists("notes/a.md")).toBe(true);
    await adapter.deleteFile("notes/a.md");
    expect(await adapter.exists("notes/a.md")).toBe(false);
  });

  it("copies a file from an arbitrary source URI into the vault, creating parent directories", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    files.set("file:///picker/photo.jpg", "fake-image-bytes");

    await adapter.copyFile("file:///picker/photo.jpg", "attachments/photo.jpg");

    expect(await adapter.readFile("attachments/photo.jpg")).toBe("fake-image-bytes");
    expect(dirs.has(`${vaultRoot}/attachments`)).toBe(true);
  });

  it("resolves a vault-relative path to an absolute URI", () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    expect(adapter.resolvePath("notes/abc.md")).toBe(`${vaultRoot}/notes/abc.md`);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -w @simplekasten/local-engine -- adapters/expo`
Expected: FAIL — `./expo` module not found.

- [ ] **Step 4: Implement the adapter**

Create `packages/local-engine/src/adapters/expo.ts`:

```ts
import * as FileSystem from "expo-file-system";
import type { FileSystemAdapter } from "../types";

/**
 * `expo-file-system`-backed implementation of `FileSystemAdapter`, mirroring
 * `adapters/node.ts` but for React Native. `vaultRoot` is an absolute
 * `file://` URI with no trailing slash (e.g. `${FileSystem.documentDirectory}vault`,
 * noting `documentDirectory` already ends in `/`) — every path passed in is
 * relative to it.
 */
export function createExpoFsAdapter(vaultRoot: string): FileSystemAdapter {
  const resolve = (relativePath: string) => `${vaultRoot}/${relativePath}`;
  const parentDir = (uri: string) => uri.slice(0, uri.lastIndexOf("/"));

  return {
    async listFiles(dir) {
      const full = resolve(dir);
      const info = await FileSystem.getInfoAsync(full);
      if (!info.exists) return [];

      const names = await FileSystem.readDirectoryAsync(full);
      const files: string[] = [];
      for (const name of names) {
        const childInfo = await FileSystem.getInfoAsync(`${full}/${name}`);
        if (childInfo.exists && !childInfo.isDirectory) files.push(name);
      }
      return files;
    },
    async readFile(filePath) {
      return FileSystem.readAsStringAsync(resolve(filePath));
    },
    async writeFile(filePath, contents) {
      const full = resolve(filePath);
      await FileSystem.makeDirectoryAsync(parentDir(full), { intermediates: true });
      await FileSystem.writeAsStringAsync(full, contents);
    },
    async deleteFile(filePath) {
      await FileSystem.deleteAsync(resolve(filePath), { idempotent: true });
    },
    async exists(filePath) {
      const info = await FileSystem.getInfoAsync(resolve(filePath));
      return info.exists;
    },
    async ensureDir(dir) {
      await FileSystem.makeDirectoryAsync(resolve(dir), { intermediates: true });
    },
    async copyFile(sourcePath, destPath) {
      const full = resolve(destPath);
      await FileSystem.makeDirectoryAsync(parentDir(full), { intermediates: true });
      await FileSystem.copyAsync({ from: sourcePath, to: full });
    },
    resolvePath(relativePath) {
      return resolve(relativePath);
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w @simplekasten/local-engine`
Expected: PASS — all tests in the package.

- [ ] **Step 6: Export the adapter as a package subpath**

In `packages/local-engine/package.json`, add the second entry to the `"exports"` field from Task 3:

```json
  "exports": {
    ".": "./src/index.ts",
    "./adapters/node": "./src/adapters/node.ts",
    "./adapters/expo": "./src/adapters/expo.ts"
  },
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck -w @simplekasten/local-engine`
Expected: PASS, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/local-engine/src/adapters/expo.ts packages/local-engine/src/adapters/expo.test.ts packages/local-engine/package.json apps/mobile/package.json package-lock.json
git commit -m "Add an expo-file-system adapter to @simplekasten/local-engine"
```

---

## After this plan

`packages/local-engine` is now feature-complete (notes, tags, links, graph, search, attachments) and adapter-complete (Node + Expo), and `apps/desktop` consumes its adapter from the package instead of a local duplicate. The next sub-projects (each gets its own spec/plan): Desktop's standalone renderer, Mobile's rewiring onto this library, then removing `apps/web` and archiving `apps/api`/`packages/db`.
