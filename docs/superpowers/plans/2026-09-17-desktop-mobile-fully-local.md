# Desktop & Mobile Fully Local; Remove apps/web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop and Mobile become fully local (no network calls, no login) against `@simplekasten/local-engine`; `apps/web` is deleted (its UI relocates into `apps/desktop`, which no longer depends on it); docs reflect the new architecture.

**Architecture:** `apps/web`'s Next.js UI (page.tsx's `Vault`/`NoteEditor`/`GraphView`/`QuickSwitcher`, already presentational/props-driven) moves into `apps/desktop` as its renderer source, with the `Auth` screen and all remote/tRPC code deleted — it now calls `window.simplekasten.vault.*` (existing preload bridge) directly instead of a fake-tRPC shim. `apps/mobile`'s screens are rewired from `trpc.*` onto a thin local wrapper around `@simplekasten/local-engine`'s Expo adapter; login/register/auth-context/session/trpc are deleted outright since there's nothing to authenticate against. `apps/api` + `packages/db` are left in place but unused by any client — dormant, per the original spec, for a possible future opt-in sync feature — not deleted.

**Tech Stack:** Next.js (moved, unchanged config), Electron IPC (existing bridge), React Native/Expo, `@simplekasten/local-engine` (this session's prior work).

**Spec:** No separate spec doc — this plan's Context/Architecture section is the spec; scope was set directly by the user in conversation (see plan history) and constrained by `docs/superpowers/specs/2026-09-17-shared-vault-library-design.md`'s original 4-sub-project roadmap.

## Global Constraints

- `apps/api` and `packages/db` are NOT deleted or modified — dormant only.
- No new runtime dependencies beyond what's already in `apps/web`/`apps/mobile`'s package.json today (this plan relocates and deletes, it doesn't add libraries).
- Desktop keeps its existing single-active-vault-folder scope (`chooseVaultFolder` IPC, already implemented) — no multi-vault UI.
- Mobile keeps its existing fixed-vault-path scope (`FileSystem.documentDirectory + "vault/"`) — no folder picker.
- Attachment mime-type rule (`image/*` → `"photo"`, `audio/*` → `"voice"`, else rejected) is enforced by `@simplekasten/local-engine`'s `createAttachment` already — mobile just calls it, no re-validation needed client-side.
- Every task must leave `npm run typecheck --workspaces --if-present` and `npm run test --workspaces --if-present` green (except the pre-existing, unrelated `e2e` webServer failure — verified pre-existing on `main`, not caused by this plan).

---

### Task 1: Merge `apps/web` into `apps/desktop`, delete `apps/web`

**Files:**
- Create: `apps/desktop/src/app/{layout.tsx,page.tsx,globals.css}` (moved+edited from `apps/web/src/app/`)
- Create: `apps/desktop/src/components/{GraphView,NoteEditor,QuickSwitcher,QuickSwitcher.test,icons,ui}.tsx` (moved verbatim from `apps/web/src/components/`)
- Create: `apps/desktop/src/lib/vaultClient.ts` (replaces `apps/web/src/lib/{trpc.ts,localVaultClient.ts,session.ts,api.ts}`)
- Create: `apps/desktop/{next.config.js,postcss.config.mjs,tsconfig.json,next-env.d.ts,vitest.config.ts,vitest.setup.ts}` (moved from `apps/web/`)
- Modify: `apps/desktop/package.json`, `apps/desktop/main.js`
- Delete: `apps/web/` (entire directory), `apps/desktop/scripts/copy-web.js`, `apps/desktop/scripts/` (now empty)

**Interfaces:**
- Consumes: `window.simplekasten.vault.*` (existing preload bridge, unchanged — `listNotes`, `getNoteById`, `createNote`, `updateNote`, `deleteNote`, `search`, `getGraph`, `listTags`, `getVaultPath`, `chooseVaultFolder`).
- Produces: `vaultClient` object in `apps/desktop/src/lib/vaultClient.ts` with methods `listNotes(tag?)`, `getNoteById(id)`, `createNote({title,content,type?})`, `updateNote({id,title?,content?,type?})`, `deleteNote(id)`, `search(query)`, `getGraph()`, `listTags()`, `getVaultPath()`, `chooseVaultFolder()`, `showVaultLocation()` — a plain async-function object, no `.query()`/`.mutate()` wrapper shape needed anymore (that shape only existed to match tRPC's call sites for dual-mode support, which no longer exists).

- [ ] **Step 1: Copy the presentational components and static files verbatim**

```bash
mkdir -p apps/desktop/src/app apps/desktop/src/components apps/desktop/src/lib
cp apps/web/src/app/layout.tsx apps/desktop/src/app/layout.tsx
cp apps/web/src/app/globals.css apps/desktop/src/app/globals.css
cp apps/web/src/components/GraphView.tsx apps/desktop/src/components/GraphView.tsx
cp apps/web/src/components/NoteEditor.tsx apps/desktop/src/components/NoteEditor.tsx
cp apps/web/src/components/QuickSwitcher.tsx apps/desktop/src/components/QuickSwitcher.tsx
cp apps/web/src/components/QuickSwitcher.test.tsx apps/desktop/src/components/QuickSwitcher.test.tsx
cp apps/web/src/components/icons.tsx apps/desktop/src/components/icons.tsx
cp apps/web/src/components/ui.tsx apps/desktop/src/components/ui.tsx
cp apps/web/next.config.js apps/desktop/next.config.js
cp apps/web/tsconfig.json apps/desktop/tsconfig.json
cp apps/web/postcss.config.mjs apps/desktop/postcss.config.mjs
cp apps/web/vitest.config.ts apps/desktop/vitest.config.ts
cp apps/web/vitest.setup.ts apps/desktop/vitest.setup.ts
```

None of these files reference `trpc`/`Auth`/tokens — they're pure UI taking data via props (verified this session: `NoteEditor`/`GraphView`/`QuickSwitcher` have zero API calls; `layout.tsx`/`globals.css`/config files have none by nature).

- [ ] **Step 2: Write `apps/desktop/src/lib/vaultClient.ts`**

```ts
// Talks to the Electron main process via the preload bridge (see
// apps/desktop/preload.js) — every note/tag/graph/search operation is a
// local filesystem call, never a network request. No auth: there's nothing
// to log into, this window only ever has one local vault open.
declare global {
  interface Window {
    simplekasten: {
      vault: {
        listNotes: (tag?: string) => Promise<unknown>;
        getNoteById: (id: string) => Promise<unknown>;
        createNote: (input: unknown) => Promise<unknown>;
        updateNote: (input: unknown) => Promise<unknown>;
        deleteNote: (id: string) => Promise<unknown>;
        search: (query: string) => Promise<unknown>;
        getGraph: () => Promise<unknown>;
        listTags: () => Promise<unknown>;
        getVaultPath: () => Promise<string>;
        chooseVaultFolder: () => Promise<string>;
      };
    };
  }
}

function vault() {
  return window.simplekasten.vault;
}

export const vaultClient = {
  listNotes: (tag?: string) => vault().listNotes(tag),
  getNoteById: (id: string) => vault().getNoteById(id),
  createNote: (input: { title: string; content: string; type?: string }) => vault().createNote(input),
  updateNote: (input: { id: string; title?: string; content?: string; type?: string }) => vault().updateNote(input),
  deleteNote: (id: string) => vault().deleteNote(id),
  search: (query: string) => vault().search(query),
  getGraph: () => vault().getGraph(),
  listTags: () => vault().listTags(),
  getVaultPath: () => vault().getVaultPath(),
  chooseVaultFolder: () => vault().chooseVaultFolder(),
};

/** The vault folder on disk already *is* the portable export — nothing to zip. */
export async function showVaultLocation(): Promise<void> {
  const path = await vaultClient.getVaultPath();
  window.alert(`Your notes are plain files on disk:\n${path}`);
}
```

- [ ] **Step 3: Write `apps/desktop/src/app/page.tsx`**

Start from `apps/web/src/app/page.tsx`. Apply these changes:

1. Imports: drop `inferRouterOutputs`, `AppRouter`, `isLocalMode`, `session.ts` imports (`clearTokens`/`getAccessToken`/`getRefreshToken`/`setTokens`), `FORCE_LOGOUT_EVENT`, `trpc`, `downloadVaultExport`. Add `import { vaultClient, showVaultLocation } from "../lib/vaultClient";`. Keep `slugify` only if still used (it isn't, once export no longer needs a slugged filename — drop it). Keep the icon imports but drop `LogOutIcon`, `MailIcon`, `LockIcon`, `UserIcon`, `AlertCircleIcon` (only used by the deleted `Auth` component) — keep every icon still referenced by `Vault`/`EmptyState`.

2. Replace the three router-inferred types with plain local types (no more `AppRouter`):

```ts
type NoteType = "fleeting" | "literature" | "permanent" | "structure";
interface NoteListItem { id: string; zettelId: string; title: string; type: NoteType; updatedAt: string }
interface NoteDetail {
  id: string; zettelId: string; title: string; content: string; type: NoteType;
  tagNames: string[];
  backlinks: { noteId: string; title: string; zettelId: string }[];
  contents: { noteId: string | null; title: string; zettelId: string | null; resolved: boolean }[];
}
interface TagItem { id: string; name: string; noteCount: number }
interface GraphData { nodes: { id: string; title: string; zettelId: string; type: NoteType }[]; edges: { source: string; target: string }[] }
```

3. Delete the `Auth` function entirely (lines ~87-190 in the original).

4. Replace `Home()` with:

```ts
export default function Home() {
  return <Vault />;
}
```

(No more `authed`/`localMode` state, no hydration-mismatch concern — this file only ever ships inside Electron now, never prerendered for a browser that might not have `window.simplekasten` yet by first paint... but it's still a Next static export loaded via `file://`/`http://localhost:3000`, so the same "first client render must match the prerendered HTML" rule still applies in principle. Since there's no more conditional branch on `window` at all — the component unconditionally renders `Vault`, and `Vault` only touches `window.simplekasten` inside `useEffect`, same safe pattern as before — there's nothing left that can mismatch.)

5. `Vault`'s signature: `function Vault() {` (drop the `{ onLogout }` prop — nothing calls it anymore).

6. Remove all `kb`/`kbs`/`kbMenuOpen`/`newKbName`/`creatingKb`/`kbMenuRef`/`switchKb`/`createKbAndSwitch` state and the `useEffect` that loaded the KB list. Replace with:

```ts
const [vaultPath, setVaultPath] = useState<string>("");

useEffect(() => {
  vaultClient.getVaultPath().then(setVaultPath);
}, []);

async function chooseFolder() {
  const path = await vaultClient.chooseVaultFolder();
  setVaultPath(path);
  setSelected(null);
  refreshNotes(activeTag);
  refreshTags();
}

const vaultName = vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? "Simplekasten";
```

7. Every remaining call site: drop `kbId`/`kb.id` — `@simplekasten/local-engine`'s functions never took a `kbId` (there's exactly one vault per running instance). Concretely:
   - `refreshNotes(kbId, tag?)` → `refreshNotes(tag?)`, body `setNotes(await vaultClient.listNotes(tag ?? undefined))`.
   - `refreshTags(kbId)` → `refreshTags()`, body `setTags(await vaultClient.listTags())`.
   - The `useEffect(() => { if (kb) { refreshNotes(kb.id, activeTag); refreshTags(kb.id); } }, [kb])` that ran on KB change is replaced by running `refreshNotes(activeTag); refreshTags();` once on mount (a plain `useEffect(() => { refreshNotes(activeTag); refreshTags(); }, [])`), since there's no more KB to switch between within one running instance (switching *folder* — `chooseFolder` above — already re-triggers both directly).
   - The `useEffect` keyed on `activeTag` stays, calling `refreshNotes(activeTag)` (no `kb.id`).
   - `save(payload)`: `await trpc.note.update.mutate(payload)` → `await vaultClient.updateNote(payload)`; `await trpc.note.getById.query({ id: payload.id })` → `await vaultClient.getNoteById(payload.id)` (cast the `unknown` result to `NoteDetail` — every `vaultClient` call returns `unknown`, so every call site needs `as NoteDetail` / `as NoteListItem[]` / `as TagItem[]` / `as GraphData` as appropriate, same pattern that `localVaultClient.ts`'s `any`-typed methods sidestepped implicitly).
   - `openNote(id)`: `trpc.note.getById.query({id})` → `vaultClient.getNoteById(id) as NoteDetail`.
   - `openGraph()`: drop the `if (!kb) return;` guard; `trpc.note.graph.query({kbId})` → `vaultClient.getGraph() as GraphData`.
   - `exportVault()` → rename to `showVault()`, body just `await showVaultLocation();` (drop the `slugify`/filename logic entirely).
   - `createNote(title)`: drop the `if (!kb) return;` guard; `trpc.note.create.mutate({kbId, title, content: "", type: "fleeting"})` → `vaultClient.createNote({title, content: "", type: "fleeting"}) as NoteDetail` — wait, `createNote` in local-engine returns a `VaultNote` (has `id` but not the full `NoteDetail` shape with backlinks/contents/tagNames) — keep the existing two-step pattern: create, then `vaultClient.getNoteById(created.id) as NoteDetail` to get the full detail shape, exactly as the original code already did via a separate `getById` call after create.
   - QuickSwitcher's `onSearch`: `(kb ? trpc.note.search.query({kbId: kb.id, query}) : Promise.resolve([]))` → `(query) => vaultClient.search(query) as Promise<SearchResultItem[]>` (add `interface SearchResultItem { id: string; title: string; zettelId: string; snippet: string }` next to the other local types).

8. Sidebar header (the `kbMenuRef` dropdown block, lines ~426-485 in the original): replace the whole dropdown (KB list + "new vault name" input + create button + "Export vault…") with a much smaller block — vault name (from `vaultName` above) + a "Choose vault folder…" button calling `chooseFolder()` + a "Show vault location" button calling `showVault()`. No dropdown/menu-open state needed; drop `kbMenuOpen`/`kbMenuRef` and their outside-click effect entirely. Keep the "Log out" button's *position* (top-right of that row) but repoint it — actually there's no equivalent action needed there anymore; drop it, and let "Choose vault folder…"/"Show vault location" sit as two plain buttons under the vault name, same visual slot the old dropdown occupied. Use the existing `DownloadIcon` for "Show vault location" (keeps that icon import alive) and add nothing new.

- [ ] **Step 4: Verify no `trpc`/`AppRouter`/`Auth`/token references remain**

Run: `grep -rn "trpc\.\|AppRouter\|useAuth\|getAccessToken\|from \"\.\./lib/session\"\|from \"\.\./lib/trpc\"\|from \"\.\./lib/localVaultClient\"" apps/desktop/src`
Expected: no matches.

- [ ] **Step 5: Wire up `apps/desktop/package.json`**

Replace the file with:

```json
{
  "name": "@simplekasten/desktop",
  "version": "0.1.0",
  "private": true,
  "main": "main.js",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:renderer\" \"npm:dev:electron\"",
    "dev:renderer": "next dev",
    "dev:electron": "wait-on http://localhost:3000 && cross-env ELECTRON_START_URL=http://localhost:3000 electron .",
    "build:renderer": "next build",
    "build": "npm run build:renderer && electron-builder",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@codemirror/autocomplete": "^6.18.4",
    "@codemirror/lang-markdown": "^6.3.0",
    "@codemirror/state": "^6.4.1",
    "@codemirror/view": "^6.34.1",
    "@simplekasten/core": "*",
    "@simplekasten/local-engine": "*",
    "codemirror": "^6.0.1",
    "next": "^15.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-force-graph-2d": "^1.29.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "concurrently": "^9.1.0",
    "cross-env": "^7.0.3",
    "electron": "^33.2.1",
    "electron-builder": "^25.1.8",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4",
    "wait-on": "^8.0.1"
  },
  "build": {
    "appId": "com.simplekasten.app",
    "productName": "Simplekasten",
    "files": ["main.js", "preload.js", "out/**/*"],
    "directories": {
      "output": "release"
    },
    "mac": {
      "icon": "icons/icon.icns"
    },
    "win": {
      "icon": "icons/icon.ico"
    },
    "linux": {
      "icon": "icons/icon.png"
    }
  }
}
```

(Copy exact version numbers from `apps/web/package.json` / `apps/desktop/package.json` — the numbers above match what's in the repo today, but check before pasting in case they've drifted.)

- [ ] **Step 6: Update `apps/desktop/main.js`'s fallback URL and delete the copy-step files**

In `apps/desktop/main.js`, change:

```js
const START_URL =
  process.env.ELECTRON_START_URL ||
  `file://${path.join(__dirname, "renderer", "index.html")}`;
```

to:

```js
const START_URL =
  process.env.ELECTRON_START_URL ||
  `file://${path.join(__dirname, "out", "index.html")}`;
```

Then:

```bash
git rm -r apps/desktop/scripts
rm -rf apps/web
```

- [ ] **Step 7: Update `.gitignore`**

Change the `# Electron` block from:

```
apps/desktop/renderer/
apps/desktop/release/
```

to:

```
apps/desktop/out/
apps/desktop/release/
```

(`out/` is Next's default `output: "export"` directory name, matching `apps/web`'s existing `.next`/`out` gitignore convention which apps/web itself relied on via the root-level `out/` gitignore line — check the root `.gitignore` still has a bare `out/` line too; if apps/desktop needs its own because the root one only matched top-level, the change above covers it either way.)

- [ ] **Step 8: Install and typecheck**

```bash
npm install
npm run typecheck -w @simplekasten/desktop
```

Expected: PASS, no errors. Fix any remaining type errors from the `unknown`-cast call sites in Step 3 before moving on.

- [ ] **Step 9: Run the desktop test suite**

```bash
npm run test -w @simplekasten/desktop
```

Expected: PASS — `QuickSwitcher.test.tsx`'s existing tests (moved verbatim, no API dependency).

- [ ] **Step 10: Manual verification (requires a display)**

```bash
npm run dev -w @simplekasten/desktop
```

Confirm: the window opens, shows the vault UI directly (no login screen), "Choose vault folder…" opens a native picker and switching folders reloads the note list, creating/editing/deleting a note persists to `.md` files, graph view and quick switcher (⌘/Ctrl+K) work, "Show vault location" alerts the current path.

- [ ] **Step 11: Commit**

```bash
git add apps/desktop package-lock.json .gitignore
git commit -m "Merge apps/web into apps/desktop as a fully local renderer; delete apps/web"
```

---

### Task 2: Mobile — remove auth, wire screens onto the local vault

**Files:**
- Create: `apps/mobile/src/lib/vault.ts`
- Modify: `apps/mobile/src/app/index.tsx`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/vault/index.tsx`, `apps/mobile/src/app/vault/[id].tsx`, `apps/mobile/src/lib/attachments.ts`, `apps/mobile/src/components/PhotoThumbnail.tsx`, `apps/mobile/src/components/VoiceNotePlayer.tsx`, `apps/mobile/package.json`
- Delete: `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/register.tsx`, `apps/mobile/src/lib/auth-context.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/trpc.ts`

**Interfaces:**
- Consumes: `@simplekasten/local-engine` (all exports) + `@simplekasten/local-engine/adapters/expo`'s `createExpoFsAdapter` (this session's prior work).
- Produces: `vault` object in `apps/mobile/src/lib/vault.ts` — same method surface as Task 1's `vaultClient`, plus `createAttachment({noteId,sourcePath,filename,mimeType})`, `listAttachments(noteId)`, `deleteAttachment(id)`, `getAttachmentFilePath(id)`.

- [ ] **Step 1: Write `apps/mobile/src/lib/vault.ts`**

```ts
import * as FileSystem from "expo-file-system";
import { createExpoFsAdapter } from "@simplekasten/local-engine/adapters/expo";
import * as engine from "@simplekasten/local-engine";

// One fixed vault directory — no folder picker on mobile (see the shared
// vault library spec's "Vault location" section).
const VAULT_ROOT = `${FileSystem.documentDirectory}vault`;
const fs = createExpoFsAdapter(VAULT_ROOT);

export const vault = {
  listNotes: (tag?: string) => engine.listNotes(fs, tag),
  getNoteById: (id: string) => engine.getNoteById(fs, id),
  createNote: (input: engine.CreateNoteInput) => engine.createNote(fs, input),
  updateNote: (input: engine.UpdateNoteInput) => engine.updateNote(fs, input),
  deleteNote: (id: string) => engine.deleteNote(fs, id),
  search: (query: string) => engine.searchNotes(fs, query),
  getGraph: () => engine.getGraph(fs),
  listTags: () => engine.listTags(fs),
  createAttachment: (input: engine.CreateAttachmentInput) => engine.createAttachment(fs, input),
  listAttachments: (noteId: string) => engine.listAttachments(fs, noteId),
  deleteAttachment: (id: string) => engine.deleteAttachment(fs, id),
  getAttachmentFilePath: (id: string) => engine.getAttachmentFilePath(fs, id),
};
```

- [ ] **Step 2: Delete the auth screens and libs**

```bash
git rm apps/mobile/src/app/login.tsx apps/mobile/src/app/register.tsx apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/session.ts apps/mobile/src/lib/trpc.ts
```

- [ ] **Step 3: Rewrite `apps/mobile/src/app/index.tsx`**

```ts
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/vault" />;
}
```

- [ ] **Step 4: Rewrite `apps/mobile/src/app/_layout.tsx`**

```ts
import { Stack } from "expo-router";
import { useThemeColors } from "@/theme";

export default function RootLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="vault/index" options={{ title: "Simplekasten" }} />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Rewrite `apps/mobile/src/app/vault/index.tsx`**

Same component, with: drop `useAuth`/`logout`/`getRefreshToken`/`onLogout` and the header row's logout button entirely; drop the `KnowledgeBase`/`kb` state and the `knowledgeBase.list.query()` call (no KB concept — one fixed vault); `load(tag?)` becomes:

```ts
const load = useCallback(async (tag?: string | null) => {
  const [noteList, tagList] = await Promise.all([
    vault.listNotes(tag ?? undefined) as Promise<NoteListItem[]>,
    vault.listTags() as Promise<TagItem[]>,
  ]);
  setNotes(noteList);
  setTags(tagList);
}, []);
```

`createNote()`:

```ts
async function createNote() {
  if (creating) return;
  setCreating(true);
  try {
    const note = (await vault.createNote({ title: "Untitled", content: "", type: "fleeting" })) as { id: string };
    router.push(`/vault/${note.id}`);
  } finally {
    setCreating(false);
  }
}
```

Replace the imports (`inferRouterOutputs`/`AppRouter`/`useAuth`/`getRefreshToken`/`trpc`) with `import { vault } from "@/lib/vault";` and plain local types:

```ts
interface NoteListItem { id: string; zettelId: string; title: string; type: "fleeting" | "literature" | "permanent" | "structure"; updatedAt: string }
interface TagItem { id: string; name: string; noteCount: number }
```

The header row (`<Text>{kb?.name ?? "Simplekasten"}</Text>` + logout `<Pressable>`) becomes a plain static `<Text style={...}>Simplekasten</Text>` with no logout button — or drop the header row entirely and rely on the `Stack.Screen`'s own title (already set to "Simplekasten" in `_layout.tsx`), which is simpler; either is fine, prefer dropping it (less code, the screen title already shows it).

- [ ] **Step 6: Rewrite `apps/mobile/src/app/vault/[id].tsx`**

Same component, with: `import { trpc } from "@/lib/trpc"` → `import { vault } from "@/lib/vault"`; `import { uploadAttachment } from "@/lib/attachments"` stays (Step 7 rewrites what it does internally, not its call signature at this site — actually its signature changes, see Step 7, update the call site accordingly); drop the `AppRouter`/`inferRouterOutputs` import, replace with:

```ts
type NoteType = "fleeting" | "literature" | "permanent" | "structure";
interface Attachment { id: string; kind: "photo" | "voice" }
interface NoteDetail {
  id: string; zettelId: string; title: string; content: string; type: NoteType;
  tagNames: string[]; attachments: Attachment[];
  backlinks: { noteId: string; title: string }[];
  contents: { noteId: string | null; title: string; resolved: boolean }[];
}
```

Call-site changes:
- `trpc.note.getById.query({ id })` → `vault.getNoteById(id) as Promise<NoteDetail>` (in both the mount effect and `refreshNote()`).
- `trpc.note.update.mutate({ id, ...next })` → `vault.updateNote({ id, ...next })`.
- `trpc.attachment.delete.mutate({ id: attachmentId })` → `vault.deleteAttachment(attachmentId)`.
- `uploadAttachment(id, { uri: asset.uri, name: ..., mimeType: ... })` → `vault.createAttachment({ noteId: id, sourcePath: asset.uri, filename: ..., mimeType: ... })` (same call shape, just direct — Step 7 removes `uploadAttachment` itself, so update this import/call together with that step). Same for the voice-note upload call.

Everything else (dictation, recording, image picking, the JSX) is unchanged — none of it touches `trpc` directly.

- [ ] **Step 7: Rewrite `apps/mobile/src/lib/attachments.ts`**

```ts
// Deliberately empty of network code now — attachments live in the local
// vault's attachments/ folder (see @simplekasten/local-engine's
// createAttachment), copied there directly from whatever URI the picker or
// recorder handed back.
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}
```

(`attachmentFileUrl`/`authHeaders`/`uploadAttachment` are deleted — `PhotoThumbnail`/`VoiceNotePlayer` (Step 8) get the local file path a different way, and `vault/[id].tsx`'s Step 6 already calls `vault.createAttachment` directly instead of `uploadAttachment`.)

- [ ] **Step 8: Rewrite `apps/mobile/src/components/PhotoThumbnail.tsx`**

Replace the fetch-with-auth-header effect with a direct local-path resolve (no blob/object-URL dance needed — it's already a local `file://` URI, RN's `Image` can use it as-is):

```ts
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { vault } from "@/lib/vault";
import { useThemeColors } from "@/theme";

interface PhotoThumbnailProps {
  id: string;
  onRemove: () => void;
}

export function PhotoThumbnail({ id, onRemove }: PhotoThumbnailProps) {
  const colors = useThemeColors();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    vault.getAttachmentFilePath(id).then((path) => {
      if (!cancelled) setUri(path);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.wrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.loading, { backgroundColor: colors.surface2 }]} />
      )}
      <Pressable onPress={onRemove} style={[styles.remove, { backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: 12, color: colors.inkMuted }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  image: { width: 84, height: 84, borderRadius: 8 },
  loading: {},
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 9: Rewrite `apps/mobile/src/components/VoiceNotePlayer.tsx`**

Same simplification — no headers needed, `useAudioPlayer` takes the local URI directly:

```ts
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { vault } from "@/lib/vault";
import { useThemeColors } from "@/theme";

interface VoiceNotePlayerProps {
  id: string;
  onRemove: () => void;
}

export function VoiceNotePlayer({ id, onRemove }: VoiceNotePlayerProps) {
  const colors = useThemeColors();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    vault.getAttachmentFilePath(id).then(setUri);
  }, [id]);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        disabled={!status.isLoaded}
        style={[styles.playButton, { backgroundColor: colors.accentSoft }]}
      >
        <Text style={{ color: colors.accentInk }}>{status.playing ? "⏸" : "▶"}</Text>
      </Pressable>
      <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Voice note</Text>
      <Pressable onPress={onRemove} style={styles.remove}>
        <Text style={{ color: colors.inkFaint, fontSize: 13 }}>Remove</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  playButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  remove: { marginLeft: "auto" },
});
```

- [ ] **Step 10: Drop now-unused dependencies from `apps/mobile/package.json`**

Remove `@trpc/client` (dependency), `@trpc/server`, `@simplekasten/api` (devDependencies) — nothing imports them anymore after Steps 2-9. Check `expo-secure-store` — it was only used by the now-deleted `session.ts`; confirm with `grep -rn "expo-secure-store" apps/mobile/src` (expect no matches) before removing it too.

- [ ] **Step 11: Install and typecheck**

```bash
npm install
npm run typecheck -w @simplekasten/mobile
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile
git rm apps/mobile/src/app/login.tsx apps/mobile/src/app/register.tsx apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/session.ts apps/mobile/src/lib/trpc.ts 2>/dev/null || true
git commit -m "Mobile: remove auth, wire screens onto the local vault directly"
```

---

### Task 3: Update docs for the new architecture

**Files:**
- Modify: `README.md`, `DEVELOPMENT_PLAN.md`, `IMPLEMENTATION_PLAN.md`
- Modify: `apps/desktop/README.md` (if it still references choosing a vault the old way — check content first)

- [ ] **Step 1: Read the current README.md and both plan docs in full before editing**

They were last substantially rewritten in the UI-redesign commits (`e406124`, `0a878c8`, `6d7e98e`) — don't assume their prior-session content, read fresh.

- [ ] **Step 2: Update README.md**

Replace any architecture description that says "web app talks to Express+tRPC+Postgres, desktop/mobile do too" with: Desktop and Mobile are fully local (Electron/Expo, `@simplekasten/local-engine`, markdown+YAML-frontmatter vault on disk, no account, no network); `apps/web` no longer exists; `apps/api`+`packages/db` remain in the repo but dormant (no client uses them today) as the future home of an opt-in cross-device sync feature. Update any setup/run instructions that reference `npm run dev -w @simplekasten/web` or a login step for desktop.

- [ ] **Step 3: Update DEVELOPMENT_PLAN.md and IMPLEMENTATION_PLAN.md**

Same correction — these documented the original "every client talks to the API" design; add a note (or rewrite the relevant section) that this shipped differently: Desktop/Mobile are local-first, Web was removed, API/DB are dormant. Don't rewrite the whole document's history/reasoning — these are living design docs, so update the architecture section(s) to match current reality and leave the rest.

- [ ] **Step 4: Commit**

```bash
git add README.md DEVELOPMENT_PLAN.md IMPLEMENTATION_PLAN.md apps/desktop/README.md
git commit -m "Update docs for the fully-local desktop/mobile architecture"
```
