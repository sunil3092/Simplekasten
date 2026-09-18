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

## Build

```
npm run build -w @simplekasten/desktop
```

Builds the static Next.js export into `out/` and runs electron-builder to
produce a platform-native installer (dmg/nsis/AppImage depending on the host
OS) in `release/`.
