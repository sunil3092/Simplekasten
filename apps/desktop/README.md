# Simplekasten Desktop (Electron)

Fully local, offline note-taking app — no login, no API. The renderer (this
app's own Next.js UI, under `src/`) talks only to the Electron main process
over IPC (see `preload.js` / `main.js`), which reads and writes the vault as
plain markdown files on disk via `@simplekasten/local-engine`.

## Run

```
npm run dev -w @simplekasten/desktop
```

This starts the Next.js dev server on `localhost:3000` and opens it in a
native Electron window once the dev server is ready. Requires a display —
this won't render anything over a headless remote session.

## Finding your way around

- **Sidebar:** Create, Navigate, Views, Tags, Maps of Content, Canvases,
  Journal and the note list each fold away from their heading. Settings
  stays pinned at the bottom.
- **Settings:** the vault folder (choose a folder, or reveal it on disk),
  the theme, and light or dark mode.
- **Purge vault** (Settings → Vault): permanently deletes every note with
  its version history and attachments, every canvas and every template.
  It asks twice — a warning listing what will go, then the vault's name
  typed out. Installed themes, settings and any other files in the vault
  folder are left alone.
- **Views:** Graph view, Flow view (`docs/features/flow-view.md`) and
  canvases (`docs/features/canvas.md`) open full-screen over the editor.
- **No menu bar:** on Windows and Linux the File/Edit/View menu is removed.
  In `npm run dev`, `F5`/`Ctrl+R` still reload and `F12`/`Ctrl+Shift+I`
  still open DevTools. macOS keeps its system menu.

## Test

```
npm run test -w @simplekasten/desktop        # unit tests (Vitest)
npm run test:e2e -w @simplekasten/desktop    # browser tests (Playwright)
```

The Playwright specs in `e2e/` load the renderer in Chromium with the preload
bridge stubbed (`e2e/bridge.ts`), so they need neither Electron nor a real
vault. Install the browser once with `npx playwright install chromium`. They
start `npm run dev:renderer` themselves, or reuse one already on port 3000.
Output goes to the repo-root `test-results/` — deliberately outside this
folder, since Next's dev server watches it and would hot-reload mid-test.

Electron doesn't implement `window.prompt()`, `confirm()` or `alert()` the
way a browser does — `prompt()` shows nothing at all — and the browser tests
can't catch that. Ask for input with `PromptDialog` or `ConfirmDialog` from
`src/components/ui.tsx` instead.

## Demo

```
npm run demo -w @simplekasten/desktop
```

Rebuilds `docs/demo/tour.gif`, the walkthrough in the root README, by driving
the renderer through `demo/tour.demo.ts` and joining the screenshots. Run it
after a UI change that makes the walkthrough out of date.

## Theming

Classic is the default theme; Memphis and SnowUI are the alternatives (Settings → Theme).
`ThemeProvider` applies the active theme as CSS variables on `<html>`
(`src/lib/themeRuntime.ts`). `src/app/globals.css` carries the Classic values as
first-paint fallbacks — `globals.test.ts` fails if they drift from
`packages/themes`. Use theme tokens (`bg-surface`, `text-ink`, `border-line`,
`bg-accent`…) rather than raw colours; canvas code such as the graph reads
`useTheme().resolved.colors`. Shared building blocks (`Button`, `Modal`,
`SectionHeading`, `NoteLink`…) live in `src/components/ui.tsx`.

## Build

```
npm run build -w @simplekasten/desktop
```

Builds the static Next.js export into `out/` and runs electron-builder to
produce a platform-native installer (dmg/nsis/AppImage depending on the host
OS) in `release/`.
