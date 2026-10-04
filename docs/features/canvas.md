# Feature: Visual Canvas / Whiteboard

**Status:** shipped 2026-09-25.
**Why:** gap analysis item #4. Heptabase's signature feature, and Obsidian
and Tana both ship one — spatial arrangement of notes complements graph
view (which lays notes out by an algorithm) with a place the user
arranges by hand: grouping related permanent notes while drafting an
essay, sketching how a project's pieces fit together, and so on. This is
the only remaining backlog item that's both high-value and fits the
local file-based vault model without a rewrite or an external product
decision — the other Large items either need a whole new surface (the web
clipper needs a browser extension this monorepo doesn't have) or risk the
core data model (block transclusion).

## Scope decision (v1)

**A corkboard, not a diagramming tool.** A canvas is a 2D surface holding
two kinds of resizable, freely-positioned cards:

- **Note cards** — a reference to an existing note (by id); shows its
  title and a content preview; opens that note when clicked.
- **Text cards** — freeform markdown text that lives only on the canvas,
  for a scratch thought that doesn't deserve its own note.

**No connecting lines/edges in v1.** Obsidian's canvas format supports
arrows between cards; that's a meaningfully larger UI (drag-from-edge
gesture, arrow routing/rendering, an edge data model) for a capability
most spatial-arrangement use cases don't need — grouping and positioning
alone answers "how do these pieces relate" for the common case. Same
reasoning Spaced Repetition used to scope out anything beyond the four
SM-2 ratings: ship the part that answers the actual question first.

**Desktop authors, mobile views.** Same split Templates established:
creating/dragging/resizing cards is a precise, cursor-and-keyboard task;
mobile gets a real, useful capability (pan/zoom a canvas, tap a note card
to open it) without trying to make touch-drag-and-resize work well in v1.

## Data model (`packages/local-engine`)

A canvas is **not** a note — its "content" is structured data, not
markdown, so treating it as one would break every place that assumes note
content is prose (search snippets, `#hashtag`/`[[link]]` extraction, the
graph). It's its own top-level entity, stored as plain JSON — same
"non-markdown vault data is just a JSON file" convention
`packages/themes` already uses for installed themes
(`<vault>/themes/<id>.json`):

```
<vault>/canvases/<id>.json
```

```ts
// packages/local-engine/src/canvas-file.ts
export interface CanvasNodeCard {
  id: string;
  kind: "note";
  noteId: string;
  x: number; y: number; width: number; height: number;
}
export interface CanvasTextCard {
  id: string;
  kind: "text";
  text: string;
  x: number; y: number; width: number; height: number;
}
export type CanvasCard = CanvasNodeCard | CanvasTextCard;

export interface CanvasData {
  id: string;
  title: string;
  cards: CanvasCard[];
  createdAt: string;
  updatedAt: string;
}

export function parseCanvasFile(raw: string, id: string): CanvasData
export function serializeCanvasFile(canvas: CanvasData): string // JSON.stringify(…, null, 2)
```

## `packages/local-engine/src/canvas.ts` — new functions

```ts
export interface CanvasListItem { id: string; title: string; updatedAt: string }

export async function listCanvases(fs: FileSystemAdapter): Promise<CanvasListItem[]>
export async function createCanvas(fs: FileSystemAdapter, input: { title: string }): Promise<CanvasData>
// starts with an empty cards array

export async function getCanvas(fs: FileSystemAdapter, id: string): Promise<CanvasData>

export interface UpdateCanvasInput { id: string; title?: string; cards?: CanvasCard[] }
export async function updateCanvas(fs: FileSystemAdapter, input: UpdateCanvasInput): Promise<CanvasData>
// cards is replaced wholesale, not diffed/merged — same "the debounced
// save writes the full current state" model note content already uses;
// a canvas is small enough (a personal vault's worth of cards) that this
// is never a real cost.

export async function deleteCanvas(fs: FileSystemAdapter, id: string): Promise<void>
```

A canvas doesn't need version history or the review queue — those are
note-content concerns; if that turns out wrong in practice, it can be
added the same way `note-file.ts`'s fields grew over three features, not
speculatively now.

## Desktop UI (`apps/desktop`)

- IPC (`main.js`/`preload.js`/`vaultClient.ts`) gains the four calls.
- A new `layout` icon (a simple 2x2 grid glyph) in `packages/core/src/icons.ts`.
- Sidebar: a "Canvases" section (same pattern as the Journal/Maps of
  Content standing sections) listing existing canvases plus a "+ New
  canvas" row, opening the canvas full-screen — same full-screen-overlay
  reasoning `GraphView`/`ReviewSession` already established: a canvas is
  the primary activity for as long as it's open.
- `CanvasView.tsx` (new): a pannable/zoomable surface. Panning is
  drag-on-empty-space; zooming is the mouse wheel around the cursor
  (plain `onWheel`/`onMouseDown`/`onMouseMove` handlers — no new
  dependency, same hand-rolled approach mobile's `graph.tsx` already
  uses for its own pan/zoom, just translated to mouse events instead of
  `PanResponder` touches). Cards are absolutely-positioned `div`s inside
  a single CSS-transformed (`translate() scale()`) layer, each
  draggable by its header and resizable by a corner handle (plain
  mousedown/mousemove/mouseup, no dependency). A toolbar offers "+ Note
  card" (opens `QuickSwitcher` in note-picking mode to choose an
  existing note) and "+ Text card" (adds a blank card at the current
  viewport center). Card position/size changes are debounced into
  `updateCanvas` the same 600ms way note edits are.
- Note cards show the referenced note's title and a short content
  preview; clicking one closes the canvas and opens that note (same
  "click a graph node, land on the note" pattern `GraphView` uses). Text
  cards are inline-editable `textarea`s.

## Mobile UI (`apps/mobile`)

- `src/lib/vault.ts` gains the same four calls (read/list/delete; no
  `updateCanvas` call needed on mobile since it's view-only in v1).
- A "Canvases" list screen (reachable from the Command Palette's command
  list, alongside Today/Review/Graph — "Canvases" joins that list) shows
  existing canvases; tapping one pushes into a **view-only**
  `app/canvas/[id].tsx`: the same pan/zoom gesture code `graph.tsx`
  already has (one-finger pan, two-finger pinch-zoom, tap-to-select — here
  tap opens the referenced note instead of selecting a graph node), cards
  rendered at their stored position/size, but not draggable or
  resizable, and text cards rendered as read-only text. No card-creation
  UI on mobile v1.

## Testing plan

- `packages/local-engine`: `canvas-file.ts` round-trip tests (same shape
  as `note-file.test.ts`/`history-file.test.ts`), and `canvas.ts` unit
  tests for create/list/get/update (wholesale card replacement,
  `updatedAt` bump)/delete, plus deleting a note that's referenced by a
  card leaving a dangling `noteId` (resolved the same way an unresolved
  `[[link]]` is: the UI treats it as "not found" rather than the engine
  needing to cascade-clean canvases on every note delete).
- `apps/desktop`: extend `e2e/bridge.ts` with canvas fixtures; a new
  `canvas.e2e.ts` covering creating a canvas, adding a note card and a
  text card, dragging a card (position persists on reopen), and clicking
  a note card opens that note.
- `apps/mobile`: `tsc` typecheck, then the same visual-smoke-through-Expo-web
  process every other feature here has used.

## Where this left off

Shipped 2026-09-25, implemented close to spec with one structural
deviation:

- **local-engine**: `canvas-file.ts` (JSON parse/serialize, 5 round-trip
  tests) and the CRUD functions — deviation from the spec's sketch: the
  domain types (`CanvasData`/`CanvasCard`/`CanvasListItem`/
  `CreateCanvasInput`/`UpdateCanvasInput`) live in `types.ts` (matching
  where `Template`'s type already lives) rather than in `canvas-file.ts`,
  and the CRUD functions themselves live in the single `vault.ts` module
  rather than a separate `canvas.ts` — that's the actual codebase
  convention every other entity (templates, attachments, review queue,
  history) already follows, despite the spec's original sketch suggesting
  a split file. 8 new tests cover create/list-ordering/get/wholesale-card-
  replacement/partial-update/delete/not-found.
- **Desktop**: `CanvasView.tsx` — a full-screen, hand-rolled pannable/
  zoomable corkboard (mouse-event pan/zoom, drag-by-header cards, a
  corner resize handle), a sidebar "Canvases" section, and "New canvas…"
  using `window.prompt` for the title (same pragmatic native-dialog
  precedent `showVaultLocation` already set, rather than building a modal
  just for one text field). No connecting lines, per the v1 scope
  decision. `canvas.e2e.ts` covers create/add-both-card-kinds/persist-on-
  reopen/open-note-from-card/remove-card. 30 desktop e2e specs total, all
  green. A screenshot confirmed drag actually repositions a card visually,
  not just in the data.
- **Mobile**: view-only exactly as specced — `listCanvases`/`getCanvas`
  only (no create/update), a "Canvases" command palette entry, a list
  screen, and `canvas/[id].tsx` reusing `(tabs)/graph.tsx`'s hand-rolled
  pan/pinch-zoom `PanResponder` code, adapted from circular node hit-
  testing to rectangular card hit-testing. Verified via `tsc` (clean) and
  a visual smoke test — the command entry and the (empty, since canvases
  live in an `expo-file-system` write mobile's web target can't perform)
  list screen both render correctly, the list screen's own `.catch()`
  degrading gracefully instead of crashing like some earlier mobile
  screens (`review.tsx`) do on this platform limitation.

Full-suite final check: 183 unit tests (desktop 32, core 19, local-engine
100, themes 32) + 30 desktop e2e tests, all green; `tsc --noEmit` clean
across all five workspaces.
