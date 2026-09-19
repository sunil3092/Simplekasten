# Installable themes (Memphis) — design

## Goal

Let desktop and mobile share one theme format. Themes are single JSON files a
user can install (VS Code-extension style), managed from a Settings modal. Ship
a built-in **Memphis** theme alongside the current look as **Default**.

## Decisions

- **Install = import a JSON file.** No server, no gallery. Fits the fully-local architecture.
- **A theme controls colours, shape and font** — not decorations/SVG patterns (out of scope).
- **Shared package** `@simplekasten/themes` is the single source of truth; each app has a thin adapter.

## Theme file format (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "id": "memphis",
  "name": "Memphis",
  "author": "optional",
  "colors": { "light": { "...": "#hex" }, "dark": { "...": "#hex" } },
  "shape": { "borderWidth": 3, "radius": 0, "shadow": { "x": 4, "y": 4, "color": "#111111" } },
  "font": { "display": "rounded-bold", "body": "sans", "mono": "mono" }
}
```

- Colour keys (all required in each variant that is present): `bg`, `surface`,
  `surface2`, `ink`, `inkMuted`, `inkFaint`, `line`, `lineSoft`, `accent`,
  `accentInk`, `accentSoft`, `accent2`, `accent2Soft`, `danger`, `dangerSoft`.
  Values are `#rgb`/`#rrggbb`.
- `light` required, `dark` optional; a theme with no `dark` is used in both modes.
- `shape`: `borderWidth` 0–6 px, `radius` 0–24 px, `shadow` `{x,y}` 0–16 px + colour; `shadow` may be omitted (no shadow).
- `font` values come from a fixed keyword list: `sans`, `rounded-bold`, `serif`, `mono`.
  Themes cannot load code or remote fonts; a file is inert data.
- `id`: lowercase `[a-z0-9-]`, 1–40 chars. Built-in ids (`default`, `memphis`) are reserved; installing a file with a built-in id is rejected.

## Package: `packages/themes` (`@simplekasten/themes`)

Pure TypeScript, depends only on `zod`.

- `themeSchema` / `Theme` type.
- `parseTheme(json: string): { ok: true, theme } | { ok: false, errors: string[] }` — never throws; errors are human-readable (path + message).
- `resolveTheme(theme, mode: "light" | "dark"): ResolvedTheme` — picks the variant (falling back to `light`), returns colours + shape (with defaults filled in) + font keywords.
- `builtInThemes`: `defaultTheme` (today's palette, values unchanged) and `memphisTheme`.
- `themeStorage` helpers over `FileSystemAdapter` from `@simplekasten/local-engine`: `listInstalledThemes`, `installTheme`, `removeTheme`, storing `<vault>/themes/<id>.json`. Invalid files on disk are skipped and reported, not fatal.

## Memphis theme

Cream background, hot-pink / teal / yellow accents, near-black 3px borders,
square corners, hard (blur-free) 4px offset shadow, `rounded-bold` display font.
Dark variant: deep navy background, same saturated accents, light ink, light
shadow colour kept visible against the dark background.

## App settings

`settings.json` (desktop: Electron userData, next to the existing settings;
mobile: app document directory) gains `theme: string` (default `"default"`) and
`themeMode: "system" | "light" | "dark"` (default `"system"`). An unknown or
invalid theme id at startup falls back to `default` and surfaces a notice.

## Desktop

- `applyTheme(resolved)` writes CSS variables on `<html>`: existing `--color-*`
  plus new `--radius`, `--border-w`, `--shadow-x`, `--shadow-y`, `--shadow-color`,
  and font stacks `--font-display/body/mono`. The current `prefers-color-scheme`
  block in `globals.css` is replaced by the resolved mode, so the mode selector works.
- Hard-coded `rounded-*`, `shadow-*` and border-width classes in components move to
  the new variables (Tailwind arbitrary values, e.g. `rounded-(--radius)`), so shape
  changes actually render.
- Main process: IPC `themes:list`, `themes:install` (opens a file dialog, validates,
  copies into the vault), `themes:installFromText` (paste JSON), `themes:remove`,
  and `settings:get/set`; exposed on `window.simplekasten` in `preload.js`.
- Settings modal: gear button in the sidebar opens a modal (existing Jump-to modal
  pattern) with a Theme section — list with swatch preview and radio, mode
  System/Light/Dark, "Install theme…", "Paste JSON", Remove on installed themes.
  Validation errors are shown inline.

## Mobile

- `useThemeColors()` returns resolved colours from the active theme (replacing the
  hard-coded `lightColors`/`darkColors`); a `useTheme()` hook also exposes shape and
  font. Shared components use `borderWidth`/`borderRadius` from it; hard shadow is
  emulated with an offset background view (React Native has no blur-free box shadow).
- Settings screen presented as a modal from a gear in the vault header, same content
  as desktop. "Install theme…" uses `expo-document-picker` (new dependency); "Paste JSON" is the fallback.

## Cross-device caveat

Themes live in the vault folder, so they travel with it. The app has no
device-to-device sync today; install the file on each device or copy the vault.

## Testing

- Unit (vitest) in `packages/themes`: valid theme, each rejection path (bad colour,
  unknown font keyword, out-of-range shape, reserved id, bad schemaVersion), missing
  `dark` fallback, install/list/remove against the in-memory FS helper, invalid file
  skipped on list.
- Playwright on desktop (stubbed `window.simplekasten`): open modal, switch to
  Memphis, assert CSS variables and a screenshot; install via paste, invalid JSON shows an error.
- Mobile: typecheck and unit tests only; no device run available in this environment.

## Out of scope

Decorative patterns/SVG assets, custom/remote fonts, online gallery, device sync,
per-note styling, editor syntax-highlight theming.
