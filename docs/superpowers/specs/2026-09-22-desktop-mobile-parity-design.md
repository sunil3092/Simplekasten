# Desktop / mobile feature and design parity

**Date:** 2026-09-22
**Status:** Approved (approach A)

## Goal

Desktop and mobile read and write the same vault, but they have drifted apart:
each has features the other lacks, and mobile doesn't follow the shared
design language. This change makes them offer the same features, look like
one product, and stay that way. It also removes speech-to-text dictation
from the mobile build.

## Decisions

- **Dictation is removed; voice notes stay.** `expo-speech-recognition` is
  dropped from the dependencies, the Expo plugin list and the note screen.
  Recording, playing and deleting voice-note attachments (`expo-audio`) is
  kept.
- **Desktop attachments: view, add and remove.** Desktop shows photos, plays
  voice notes, attaches an image or audio file through a file picker, and
  removes attachments. It does not record.
- **Mobile gains everything desktop has:** search with create-from-search,
  a maps of content section, link and tag behaviour, and graph parity.
- **Delete note in both apps**, behind a confirmation.
- **Approach A:** share *definitions* (note types, icon geometry, UI copy)
  from `packages/core`. Each app keeps its own renderer: Tailwind and
  CodeMirror on desktop, React Native on mobile.

Platform differences that stay: the vault folder picker (mobile uses one
fixed vault), keyboard shortcuts (desktop), pull-to-refresh (mobile), and
voice recording (mobile only).

## 1. Shared layer (`packages/core`)

### `noteTypes.ts` (in `packages/themes`)

Moved from `apps/desktop/src/lib/noteTypes.ts` to `packages/themes`, not
`packages/core`: it needs `ColorKey`, and `core` depending on `themes`
would create a cycle (`themes` → `local-engine` → `core`). One entry per
note type:

```ts
interface NoteTypeInfo {
  value: NoteType;
  label: string;
  graphColor: ColorKey;           // theme colour for graph nodes and legend dots
  badge: { bg: ColorKey; fg: ColorKey; border: ColorKey; dashed?: boolean };
}
export const NOTE_TYPES: NoteTypeInfo[];
export function noteTypeInfo(type: string): NoteTypeInfo; // falls back to fleeting
```

Badges are written as theme colour keys, not Tailwind classes. Desktop maps
each key to its matching `bg-*` / `text-*` / `border-*` utility through a
small static lookup; mobile turns the keys into style objects. The values
stay the same as desktop has now:

- **fleeting:** surface2 / inkMuted / line
- **literature:** accent2Soft / accent2 / accent2
- **permanent:** accentSoft / accentInk / accent
- **structure:** surface2 / inkMuted / line, dashed

Deleting a note is a soft delete in the engine (the file stays on disk with
`deletedAt` set), so the confirmation says so and doesn't promise that
attachments are removed.

### `icons.ts`

The desktop icon set (24×24 viewBox, 1.75 stroke, round caps and joins)
becomes data:

```ts
type IconShape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number };
export const ICONS: Record<IconName, IconShape[]>;
```

Desktop's `icons.tsx` draws this data as web SVG, keeping its existing
exported names (`SearchIcon`, …). Mobile's `components/Icon.tsx` draws the
same data with `react-native-svg`. New glyphs, drawn once and used by both
apps: `camera`, `image`, `mic`, `stop`, `play`, `pause`, `trash`,
`paperclip`, `note` (for the tab bar). All emoji on mobile, tab bar
included, are replaced by these icons.

### `copy.ts`

Text both apps must show word for word: the empty vault, the editor
placeholder, the empty links and empty mentions text, the search
placeholder, "Create “…”", the delete confirmation title and body, the save
status labels, and the empty graph.

## 2. Mobile

### Shared components (`src/components/ui.tsx`)

Mirrors desktop's `ui.tsx`: `Button` (primary, secondary, ghost, danger),
`Chip`, `SectionHeading`, `NoteLink` (zettel ID + title, dashed when
unresolved), `SaveStatus`, `SegmentedControl`, `TypeBadge`. Every border
width, corner radius and shadow comes from the theme's `shape`, and every
colour from the theme's `colors`. That replaces the hard-coded
`borderWidth: 1`, `borderRadius: 8`, `#c0392b` and `#00000010`.

### Vault tab

From top to bottom:

1. A search field. It runs the engine's `searchNotes`, debounced 150 ms,
   the same timing as desktop. With a query, the list shows results with
   highlighted snippets (the same `\u0001…\u0002` sentinel split desktop
   uses), plus a "Create “q”" row when no title matches exactly.
2. The "New note" primary button.
3. Tag chips (unchanged behaviour). The active tag can also come in as a
   route parameter, so a tag chip on the note screen can filter the list.
4. A **Maps of content** section with dashed rows for structure notes,
   shown only when some exist and no search is active.
5. The note list, with a "N notes · #tag" count line and a "clear" link,
   as on desktop.

### Note screen

- **Header:** coloured type badges from `NOTE_TYPES`, the zettel ID, the
  save status, and a trash button in the navigation header. The trash
  button asks for confirmation, calls `deleteNote`, then goes back.
- **`[[` suggestions:** while the text before the cursor matches
  `/\[\[([^\]|]*)$/`, a row of up to 8 matching note titles appears under
  the editor. Tapping one completes the link and adds the closing `]]` if
  it's missing.
- **Tag chips** navigate to the Vault tab filtered by that tag.
- **Links and mentions** use `NoteLink` with the zettel ID. Tapping an
  unresolved link creates that note and opens it, as on desktop.
- **Attachments:** the buttons get icons and theme styling (Camera, Photo,
  Voice note), errors use `colors.danger`, and `VoiceNotePlayer` and
  `PhotoThumbnail` are restyled. The dictation button and all
  speech-recognition code are gone.
- The screen records the last opened note in `lib/lastNote.ts` (a small
  in-memory store), so the graph can offer "This note".

### Graph tab

- Nodes are coloured by `noteTypeInfo(type).graphColor`, edges drawn in
  `inkFaint`, and each node is labelled with a shortened title.
- A legend lists the note types present.
- A "This note / Whole vault" segmented control appears when a note has
  been opened, using the same neighbourhood filter as desktop.
- Pan and pinch-zoom work through `PanResponder`, which is built into
  React Native (no new dependency), applied as a transform on an SVG
  group. Tapping a node opens the note.

## 3. Desktop

### Attachments

- `main.js` registers a privileged `sk-attachment://` protocol with
  streaming enabled, so audio can seek. `sk-attachment://<id>` serves the
  file at `getAttachmentFilePath`.
- New IPC calls: `vault:addAttachment(noteId)` opens a file dialog
  (images and audio), then runs `createAttachment`. `vault:deleteAttachment(id)`
  removes one. The preload script and `vaultClient` gain
  `addAttachment`, `deleteAttachment` and `attachmentUrl(id)`.
- An **Attachments** section sits below the editor: a grid of photo
  thumbnails (clicking one opens it full-size in a `Modal`), `<audio controls>`
  rows for voice notes, a remove button on each, and an "Attach file…"
  button. It shows only when attachments exist, but the attach button is
  always in the note header's action row.

### Delete note

A trash `IconButton` in the note header opens a confirmation `Modal`.
Confirming calls `deleteNote`, then opens the most recent remaining note,
or shows the empty state if none are left.

### Shared definitions

The type picker, badge, graph and legend read from
`@simplekasten/core`'s `NOTE_TYPES`. Icons read from `ICONS`. Copy reads
from `copy.ts`.

## 4. Removing dictation, and testing

- Remove `expo-speech-recognition` from `apps/mobile/package.json`, its
  plugin entry in `app.json`, and all dictation code. Re-run `npm install`
  so the lockfile drops it.
- **Unit tests (Vitest, `packages/core`):** every `NoteType` has an entry;
  every `ColorKey` referenced exists in the theme palette; `noteTypeInfo`
  falls back for unknown types; every `IconName` has at least one shape.
- **Desktop tests (Playwright, `apps/desktop/e2e`):** extend the stubbed
  bridge with attachments and delete. Add a spec that deletes a note
  (confirm and cancel), shows attachments, and removes one. The existing
  palette spec must still pass, since it checks that every painted colour
  comes from the theme.
- **Mobile:** `tsc` typecheck, then a manual run on the Android emulator
  (Pixel_7a) through Expo. Walk through: search, create from search, maps
  of content, tag filter from a note, `[[` suggestions, create from an
  unresolved link, delete, photo attach, voice note recording and
  playback, the graph's colours, legend, scope and pan/zoom, and switching
  themes between Memphis and Classic. Confirm no dictation button remains.
