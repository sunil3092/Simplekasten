# Simplekasten Desktop (Tauri)

Wraps the exact same static export of `apps/web` in a native shell — see
`IMPLEMENTATION_PLAN.md` §1 for why the frontend has no server-only Next.js
features, which is what makes this possible without a second UI.

## First-time setup

1. Generate real app icons (a 1024×1024 PNG is enough — Tauri derives every size):
   ```
   pnpm --filter @simplekasten/desktop tauri icon path/to/logo.png
   ```
   `tauri.conf.json` already points at the paths this command writes to.
2. Copy `apps/api/.env.example` to `.env` and point `NEXT_PUBLIC_API_URL`
   (in `apps/web/.env`) at a running API instance.

## Run

```
pnpm --filter @simplekasten/desktop dev
```

This starts the Next.js dev server (`beforeDevCommand` in `tauri.conf.json`)
and opens it in a native window. Requires a display — this won't render
anything over a headless remote session; `cargo check` in `src-tauri/` is
the way to verify the Rust side compiles without a GUI.

## Build

```
pnpm --filter @simplekasten/desktop build
```

Produces a platform-native installer (dmg/msi/AppImage/deb depending on the
host OS) in `src-tauri/target/release/bundle/`.
