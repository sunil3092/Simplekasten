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

## Theming

Memphis is the default theme; Classic is the alternative (Settings → Theme).
`ThemeProvider` applies the active theme as CSS variables on `<html>`
(`src/lib/themeRuntime.ts`). `src/app/globals.css` carries the Memphis values as
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
