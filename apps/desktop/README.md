# Simplekasten Desktop (Electron)

Wraps the exact same static export of `apps/web` in a native shell — see
`IMPLEMENTATION_PLAN.md` §1 for why the frontend has no server-only Next.js
features, which is what makes this possible without a second UI.

## First-time setup

Copy `apps/api/.env.example` to `.env` and point `NEXT_PUBLIC_API_URL`
(in `apps/web/.env`) at a running API instance.

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

Builds the static Next.js export, copies it into `renderer/`, and runs
electron-builder to produce a platform-native installer (dmg/nsis/AppImage
depending on the host OS) in `release/`.
