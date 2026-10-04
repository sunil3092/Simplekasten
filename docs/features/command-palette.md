# Feature: Command Palette

**Status:** shipped 2026-09-23.
**Why:** gap analysis item #10 — "cheap, compounds nicely once daily
notes/templates exist." Search-to-find-a-note (`Cmd/Ctrl+K` on desktop,
the inline search box on mobile) already exists; this adds
search-to-run-an-action on top of the exact same surface, the way VS
Code's palette lives right next to its file switcher. No new engine
capability — every action it exposes already exists as a callback in
`page.tsx` (desktop) or `index.tsx` (mobile); this is purely a UI-layer
feature.

## Interaction model

Typing `>` as the first character switches the existing search UI from
"find a note" to "run a command" — same convention VS Code, Obsidian's
command palette, and Notion's `/` menu all use for a mode switch inside one
input, so no new shortcut or entry point needs to be taught. Everything
after `>` fuzzy-filters the command list by label. Arrow keys/Enter/Escape
behave exactly as they already do for note search (desktop: `QuickSwitcher`
already implements this keyboard nav; mobile: same list interaction as
search results).

Clearing back to an empty or non-`>`-prefixed query returns to normal note
search — the two modes share one input and one results list, they don't
add a second UI surface.

## Command list (v1)

Every command already has a handler in the app's root component today —
this feature only makes them reachable from the palette:

| Command | Desktop handler | Mobile handler |
|---|---|---|
| New note | `createNote()` | `createNote()` |
| Today | `openDaily(todayLocal())` | `openToday()` |
| Review | `openReview()` | `router.push("/review")` |
| Templates… | `setTemplatesOpen(true)` | *(not exposed — mobile doesn't author templates, see templates.md)* |
| Graph view | `openGraph()` | `router.push("/graph")` |
| Settings | `setSettingsOpen(true)` | `router.push("/settings")` |
| Choose vault folder… | `chooseFolder()` | *(not applicable — mobile has one fixed vault location)* |
| Show vault location | `showVault()` | *(not applicable, same reason)* |

Each command also gets a one-line description shown under its label (e.g.
"Open or create today's daily note"), reusing the same row layout the note
list already uses, just with a command icon instead of a zettel id.

Commands are a fixed, hardcoded list (not user-configurable) for v1 — every
existing PKM command palette starts this way and adds customization later
only if asked for.

## Desktop UI (`apps/desktop`)

`QuickSwitcher.tsx` gains a `commands` prop: an array of
`{ id: string; icon: IconName; label: string; description: string; run: () => void }`.
When `query.trim().startsWith(">")`, the `items` memo swaps from
`results`/`recentNotes` to this list filtered by the text after `>`
(case-insensitive substring match on `label`, same simplicity as note
search's snippet matching). `commit()` calls `run()` and then `onClose()`
instead of `onSelect(id)`. The footer hint row's "select" label doesn't
change; no new keyboard shortcut is added since `Cmd/Ctrl+K` already opens
this component — typing `>` inside it is the only new gesture.

`page.tsx` builds the `commands` array from its existing handlers
(`createNote`, `openDaily`, `openReview`, `setTemplatesOpen`, `openGraph`,
`setSettingsOpen`, `chooseFolder`, `showVault`) and passes it to
`<QuickSwitcher>` alongside the props it already receives.

## Mobile UI (`apps/mobile`)

The vault tab's existing inline search (`(tabs)/index.tsx`) gets the same
`>`-prefix branch: when `query` starts with `>`, the `rows` computation
swaps from search results to the filtered command list, and `renderItem`
branches on a `type` discriminant (`"note" | "command"`) to show either
the existing note row or a command row (icon + label + description,
`Pressable` that calls `run()` then clears the query). Same debounce-free
path as recent notes (no network/fs round-trip needed to filter a
hardcoded list).

## Testing plan

- `apps/desktop`: extend `QuickSwitcher.test.tsx` (existing component test)
  with cases for entering command mode on `>`, filtering by label, running
  a command closes the palette and calls its handler, and typing `>` then
  backspacing back to empty returns to the recent-notes list. Add an
  e2e spec (`command-palette.e2e.ts`) covering at least "New note" and
  "Today" run end-to-end against the real page.
- `apps/mobile`: `tsc` typecheck, then the same visual-smoke-through-Expo-web
  process as every other feature (real interaction needs a device/emulator).

## Where this left off

Shipped 2026-09-23, implemented exactly as specced:

- **Desktop**: `QuickSwitcher.tsx` gained the `commands` prop and the
  `>`-prefix branch (mode-switch happens on the `trimmed.startsWith(">")`
  check, filtering by label substring after the `>`). `page.tsx` wires up
  all 8 commands from the table above using its existing handlers — no new
  handler needed anywhere. Its Modal gained a `label="Quick switcher"` (it
  had none before) so e2e specs could scope assertions to the panel rather
  than the whole page. `QuickSwitcher.test.tsx` gained a `describe("command
  mode")` block (4 new tests: mode switch, label filtering, run-and-close,
  and returning to note search on backspace); `command-palette.e2e.ts`
  covers mode switching, running "Today" and "Graph view" end-to-end, and
  the no-match empty state. 24 desktop e2e specs total, all green.
- **Mobile**: the vault tab's existing inline search got the identical
  `>`-prefix branch, with a `Row = NoteRow | CommandRow` discriminated
  union feeding one `FlatList`. 5 of the 8 commands apply on mobile (New
  note, Today, Review, Graph view, Settings) — Templates and the two
  vault-location commands are correctly left out, matching those features'
  existing desktop-only scope. Verified via `tsc` (clean) and a visual
  smoke test through Expo's web target (screenshot confirms the command
  list renders correctly with icons and descriptions); real interaction
  needs a device/emulator, same limitation every other mobile feature here
  has documented.

Full-suite final check: 150 unit tests (desktop 32, core 19, local-engine
67, themes 32) + 24 desktop e2e tests, all green; `tsc --noEmit` clean
across all five workspaces.
