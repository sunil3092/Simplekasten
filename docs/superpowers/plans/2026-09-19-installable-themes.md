# Installable Themes (Memphis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a shared theme format (`@simplekasten/themes`), a built-in Memphis theme, theme install-from-file, and a Settings modal on desktop and mobile.

**Architecture:** A new pure-TypeScript workspace package owns the theme schema (zod), parse/resolve functions, built-in themes and vault storage helpers. Desktop writes the resolved theme as CSS variables on `<html>` (Tailwind v4 utilities already read `--color-*`, `--radius-*`, `--shadow-*`); mobile feeds the same resolved theme into `useThemeColors()`/`useTheme()`. Installed themes are stored as `<vault>/themes/<id>.json` through the existing `FileSystemAdapter`.

**Tech Stack:** TypeScript, zod 3, vitest 2, Next 15 + Tailwind v4 + Electron (desktop), Expo 57 / React Native 0.86 / expo-router (mobile), Playwright MCP for desktop verification.

**Spec:** `docs/superpowers/specs/2026-09-19-installable-themes-design.md`

## Global Constraints

- Theme colour keys (exact, camelCase): `bg`, `surface`, `surface2`, `ink`, `inkMuted`, `inkFaint`, `line`, `lineSoft`, `accent`, `accentInk`, `accentSoft`, `accent2`, `accent2Soft`, `danger`, `dangerSoft`. Values `#rgb` or `#rrggbb`.
- `schemaVersion` is the literal `1`. `id` matches `^[a-z0-9-]{1,40}$`. Reserved ids: `default`, `memphis`.
- `shape.borderWidth` 0–6, `shape.radius` 0–24, `shape.shadow` `{x,y}` 0–16 + hex colour (optional).
- Font keywords are exactly: `sans`, `rounded-bold`, `serif`, `mono`. Themes never load code or remote fonts.
- `colors.light` required, `colors.dark` optional (falls back to light).
- Installed themes live at `<vault>/themes/<id>.json`. Settings keys: `theme` (default `"default"`), `themeMode` (`"system" | "light" | "dark"`, default `"system"`).
- The **Default** theme must render identically to today's app (values copied from `apps/desktop/src/app/globals.css`).
- Use `import type` for anything imported from `@simplekasten/local-engine` inside the themes package (it is TypeScript source; runtime import would pull `js-yaml` into the renderer).
- The working tree already has two unrelated uncommitted edits (`apps/desktop/src/components/NoteEditor.tsx`, `apps/desktop/src/components/GraphView.tsx`). **Never `git add -A` / `git add .`** — always add explicit paths.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Work on branch `feature/themes` (already created).
- Every desktop UI change is verified in a real browser with Playwright (stub `window.simplekasten`, run `next dev` on port 3111, stop the server and delete screenshots afterwards).

## File Structure

**Create**
- `packages/themes/package.json`, `tsconfig.json` — package scaffold
- `packages/themes/src/schema.ts` — zod schema, constants, types
- `packages/themes/src/parse.ts` — `parseTheme`
- `packages/themes/src/resolve.ts` — `resolveTheme`, `ModePreference`, `resolveModePreference`
- `packages/themes/src/builtin.ts` — `defaultTheme`, `memphisTheme`, `builtInThemes`
- `packages/themes/src/storage.ts` — `listInstalledThemes`, `installTheme`, `removeTheme`
- `packages/themes/src/index.ts` — barrel
- `packages/themes/src/*.test.ts` — tests for each
- `apps/desktop/src/lib/themeRuntime.ts` — `themeToCssVars`, `applyThemeToDocument`, `FONT_STACKS`
- `apps/desktop/src/lib/themeRuntime.test.ts`
- `apps/desktop/src/lib/themeClient.ts` — thin wrapper over `window.simplekasten.themes/settings`
- `apps/desktop/src/lib/ThemeProvider.tsx` — context, `useTheme`
- `apps/desktop/src/components/SettingsModal.tsx`, `SettingsModal.test.tsx`
- `apps/mobile/src/lib/settings.ts` — read/write mobile `settings.json`
- `apps/mobile/src/components/ThemeProvider.tsx` — provider + `useTheme`
- `apps/mobile/src/components/HardShadow.tsx`
- `apps/mobile/src/app/settings.tsx` — settings modal screen

**Modify**
- `apps/desktop/package.json` (dep), `next.config.js` (`transpilePackages`), `main.js`, `preload.js`
- `apps/desktop/src/lib/vaultClient.ts` (window typing), `src/app/layout.tsx`, `src/app/page.tsx` (gear), `src/components/icons.tsx` (gear icon)
- `apps/desktop/src/components/ui.tsx`, `QuickSwitcher.tsx`, `GraphView.tsx`, `src/app/page.tsx` (border-width class migration)
- `apps/mobile/package.json` (deps), `src/theme.ts`, `src/app/_layout.tsx`, `src/app/vault/index.tsx`, `src/lib/vault.ts`
- `docs/superpowers/specs/2026-09-19-installable-themes-design.md` (two small amendments, Task 2)
- `README.md` (Task 9)

---

### Task 1: Themes package — schema, parse, resolve

**Files:**
- Create: `packages/themes/package.json`, `packages/themes/tsconfig.json`
- Create: `packages/themes/src/schema.ts`, `parse.ts`, `resolve.ts`, `index.ts`
- Test: `packages/themes/src/parse.test.ts`, `packages/themes/src/resolve.test.ts`

**Interfaces:**
- Produces (exact):
  - `COLOR_KEYS` (readonly tuple), `type ColorKey`, `FONT_KEYWORDS`, `type FontKeyword`, `RESERVED_THEME_IDS`, `themeSchema`, `type Theme`
  - `parseTheme(json: string): ParseResult` where `type ParseResult = { ok: true; theme: Theme } | { ok: false; errors: string[] }`
  - `type ThemeMode = "light" | "dark"`, `type ModePreference = "system" | ThemeMode`
  - `interface ResolvedTheme { id: string; name: string; mode: ThemeMode; colors: Record<ColorKey, string>; shape: { borderWidth: number; radius: number; shadow: { x: number; y: number; color: string } | null }; font: Theme["font"] }`
  - `resolveTheme(theme: Theme, mode: ThemeMode): ResolvedTheme`
  - `resolveModePreference(pref: ModePreference, systemPrefersDark: boolean): ThemeMode`

- [ ] **Step 1: Scaffold the package**

`packages/themes/package.json`:
```json
{
  "name": "@simplekasten/themes",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@simplekasten/local-engine": "*",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

`packages/themes/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

Run: `npm install` (repo root). Expected: workspace linked, no errors.

- [ ] **Step 2: Write the failing tests**

`packages/themes/src/parse.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseTheme } from "./parse";

const palette = {
  bg: "#ffffff", surface: "#ffffff", surface2: "#eeeeee", ink: "#000000", inkMuted: "#333333",
  inkFaint: "#777777", line: "#cccccc", lineSoft: "#dddddd", accent: "#ff0000", accentInk: "#aa0000",
  accentSoft: "#ffdddd", accent2: "#0000ff", accent2Soft: "#ddddff", danger: "#ff0000", dangerSoft: "#ffdddd",
};

function validTheme(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "my-theme",
    name: "My Theme",
    colors: { light: palette },
    shape: { borderWidth: 1, radius: 8 },
    font: { display: "sans", body: "sans", mono: "mono" },
    ...overrides,
  };
}

describe("parseTheme", () => {
  it("accepts a minimal valid theme", () => {
    const result = parseTheme(JSON.stringify(validTheme()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.theme.id).toBe("my-theme");
  });

  it("accepts a dark palette, shadow and author", () => {
    const result = parseTheme(
      JSON.stringify(
        validTheme({
          author: "Me",
          colors: { light: palette, dark: palette },
          shape: { borderWidth: 3, radius: 0, shadow: { x: 4, y: 4, color: "#111" } },
        }),
      ),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parseTheme("not json")).toEqual({ ok: false, errors: ["Not valid JSON"] });
  });

  it("rejects a wrong schemaVersion", () => {
    const result = parseTheme(JSON.stringify(validTheme({ schemaVersion: 2 })));
    expect(result.ok).toBe(false);
  });

  it("rejects a bad colour and names the path", () => {
    const result = parseTheme(JSON.stringify(validTheme({ colors: { light: { ...palette, accent: "red" } } })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("colors.light.accent");
  });

  it("rejects a missing colour key", () => {
    const { ink: _ink, ...rest } = palette;
    const result = parseTheme(JSON.stringify(validTheme({ colors: { light: rest } })));
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown font keyword", () => {
    const result = parseTheme(JSON.stringify(validTheme({ font: { display: "comic", body: "sans", mono: "mono" } })));
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range shape values", () => {
    expect(parseTheme(JSON.stringify(validTheme({ shape: { borderWidth: 9, radius: 8 } }))).ok).toBe(false);
    expect(parseTheme(JSON.stringify(validTheme({ shape: { borderWidth: 1, radius: 99 } }))).ok).toBe(false);
  });

  it("rejects an invalid id", () => {
    expect(parseTheme(JSON.stringify(validTheme({ id: "Has Spaces" }))).ok).toBe(false);
    expect(parseTheme(JSON.stringify(validTheme({ id: "../evil" }))).ok).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    expect(parseTheme(JSON.stringify(validTheme({ script: "alert(1)" }))).ok).toBe(false);
  });
});
```

`packages/themes/src/resolve.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseTheme } from "./parse";
import { resolveModePreference, resolveTheme } from "./resolve";

const light = {
  bg: "#ffffff", surface: "#ffffff", surface2: "#eeeeee", ink: "#000000", inkMuted: "#333333",
  inkFaint: "#777777", line: "#cccccc", lineSoft: "#dddddd", accent: "#ff0000", accentInk: "#aa0000",
  accentSoft: "#ffdddd", accent2: "#0000ff", accent2Soft: "#ddddff", danger: "#ff0000", dangerSoft: "#ffdddd",
};
const dark = { ...light, bg: "#000000", ink: "#ffffff" };

function make(colors: object, shadow?: object) {
  const result = parseTheme(
    JSON.stringify({
      schemaVersion: 1, id: "t", name: "T", colors,
      shape: { borderWidth: 2, radius: 4, ...(shadow ? { shadow } : {}) },
      font: { display: "sans", body: "sans", mono: "mono" },
    }),
  );
  if (!result.ok) throw new Error(result.errors.join(", "));
  return result.theme;
}

describe("resolveTheme", () => {
  it("returns the dark palette in dark mode when present", () => {
    expect(resolveTheme(make({ light, dark }), "dark").colors.bg).toBe("#000000");
  });

  it("falls back to light when dark is missing", () => {
    expect(resolveTheme(make({ light }), "dark").colors.bg).toBe("#ffffff");
  });

  it("reports the requested mode and carries shape/font through", () => {
    const resolved = resolveTheme(make({ light }, { x: 3, y: 3, color: "#111" }), "light");
    expect(resolved.mode).toBe("light");
    expect(resolved.shape).toEqual({ borderWidth: 2, radius: 4, shadow: { x: 3, y: 3, color: "#111" } });
    expect(resolved.font.mono).toBe("mono");
  });

  it("uses a null shadow when the theme has none", () => {
    expect(resolveTheme(make({ light }), "light").shape.shadow).toBeNull();
  });
});

describe("resolveModePreference", () => {
  it("follows the system when set to system", () => {
    expect(resolveModePreference("system", true)).toBe("dark");
    expect(resolveModePreference("system", false)).toBe("light");
  });
  it("ignores the system for an explicit choice", () => {
    expect(resolveModePreference("light", true)).toBe("light");
    expect(resolveModePreference("dark", false)).toBe("dark");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -w @simplekasten/themes`
Expected: FAIL — cannot resolve `./parse` / `./resolve`.

- [ ] **Step 4: Implement**

`packages/themes/src/schema.ts`:
```ts
import { z } from "zod";

export const COLOR_KEYS = [
  "bg", "surface", "surface2", "ink", "inkMuted", "inkFaint", "line", "lineSoft",
  "accent", "accentInk", "accentSoft", "accent2", "accent2Soft", "danger", "dangerSoft",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const FONT_KEYWORDS = ["sans", "rounded-bold", "serif", "mono"] as const;
export type FontKeyword = (typeof FONT_KEYWORDS)[number];

export const RESERVED_THEME_IDS: readonly string[] = ["default", "memphis"];

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a #rgb or #rrggbb colour");

const palette = z
  .object(Object.fromEntries(COLOR_KEYS.map((key) => [key, hexColor])) as Record<ColorKey, typeof hexColor>)
  .strict();

const shapeSchema = z
  .object({
    borderWidth: z.number().min(0).max(6),
    radius: z.number().min(0).max(24),
    shadow: z
      .object({ x: z.number().min(0).max(16), y: z.number().min(0).max(16), color: hexColor })
      .strict()
      .optional(),
  })
  .strict();

const fontSchema = z
  .object({ display: z.enum(FONT_KEYWORDS), body: z.enum(FONT_KEYWORDS), mono: z.enum(FONT_KEYWORDS) })
  .strict();

export const themeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]{1,40}$/, "must be 1-40 characters of a-z, 0-9 or -"),
    name: z.string().min(1).max(60),
    author: z.string().max(80).optional(),
    colors: z.object({ light: palette, dark: palette.optional() }).strict(),
    shape: shapeSchema,
    font: fontSchema,
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;
```

`packages/themes/src/parse.ts`:
```ts
import { themeSchema, type Theme } from "./schema";

export type ParseResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

/** Never throws — returns readable errors instead, so UIs can show them inline. */
export function parseTheme(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["Not valid JSON"] };
  }

  const result = themeSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "theme"}: ${issue.message}`),
    };
  }
  return { ok: true, theme: result.data };
}
```

`packages/themes/src/resolve.ts`:
```ts
import type { ColorKey, Theme } from "./schema";

export type ThemeMode = "light" | "dark";
export type ModePreference = "system" | ThemeMode;

export interface ResolvedTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  colors: Record<ColorKey, string>;
  shape: {
    borderWidth: number;
    radius: number;
    shadow: { x: number; y: number; color: string } | null;
  };
  font: Theme["font"];
}

export function resolveTheme(theme: Theme, mode: ThemeMode): ResolvedTheme {
  const colors = mode === "dark" && theme.colors.dark ? theme.colors.dark : theme.colors.light;
  return {
    id: theme.id,
    name: theme.name,
    mode,
    colors,
    shape: {
      borderWidth: theme.shape.borderWidth,
      radius: theme.shape.radius,
      shadow: theme.shape.shadow ?? null,
    },
    font: theme.font,
  };
}

export function resolveModePreference(pref: ModePreference, systemPrefersDark: boolean): ThemeMode {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}
```

`packages/themes/src/index.ts`:
```ts
export * from "./schema";
export * from "./parse";
export * from "./resolve";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -w @simplekasten/themes && npm run typecheck -w @simplekasten/themes`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/themes package-lock.json
git commit -m "Add @simplekasten/themes package with schema, parse and resolve

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Built-in themes (Default + Memphis)

**Files:**
- Create: `packages/themes/src/builtin.ts`, `packages/themes/src/builtin.test.ts`
- Modify: `packages/themes/src/index.ts`, `docs/superpowers/specs/2026-09-19-installable-themes-design.md`

**Interfaces:**
- Consumes: `themeSchema`, `Theme` (Task 1)
- Produces: `defaultTheme: Theme`, `memphisTheme: Theme`, `builtInThemes: Theme[]` (order: default, memphis)

- [ ] **Step 1: Write the failing test**

`packages/themes/src/builtin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { builtInThemes, defaultTheme, memphisTheme } from "./builtin";
import { RESERVED_THEME_IDS, themeSchema } from "./schema";
import { resolveTheme } from "./resolve";

describe("built-in themes", () => {
  it("are all valid against the schema", () => {
    for (const theme of builtInThemes) expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("use exactly the reserved ids", () => {
    expect(builtInThemes.map((t) => t.id).sort()).toEqual([...RESERVED_THEME_IDS].sort());
  });

  it("default keeps today's palette (values from globals.css)", () => {
    expect(resolveTheme(defaultTheme, "light").colors).toMatchObject({
      bg: "#f8fafc", surface: "#ffffff", ink: "#0f172a", accent: "#059669", accent2: "#b45309", danger: "#dc2626",
    });
    expect(resolveTheme(defaultTheme, "dark").colors).toMatchObject({
      bg: "#0b1120", surface: "#111827", ink: "#f1f5f9", accent: "#34d399", accent2: "#fbbf24", danger: "#f87171",
    });
  });

  it("default keeps today's shape (1px borders, 8px radius, no shadow)", () => {
    expect(defaultTheme.shape).toEqual({ borderWidth: 1, radius: 8 });
  });

  it("memphis is chunky: thick borders, square corners, hard shadow, distinct dark palette", () => {
    expect(memphisTheme.shape.borderWidth).toBe(3);
    expect(memphisTheme.shape.radius).toBe(0);
    expect(memphisTheme.shape.shadow).toEqual({ x: 4, y: 4, color: "#ff3ea5" });
    expect(memphisTheme.colors.dark).toBeDefined();
    expect(memphisTheme.colors.dark!.bg).not.toBe(memphisTheme.colors.light.bg);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @simplekasten/themes -- builtin`
Expected: FAIL — cannot resolve `./builtin`.

- [ ] **Step 3: Implement**

`packages/themes/src/builtin.ts`:
```ts
import type { Theme } from "./schema";

/** Exactly today's look — values copied from apps/desktop/src/app/globals.css. */
export const defaultTheme: Theme = {
  schemaVersion: 1,
  id: "default",
  name: "Default",
  colors: {
    light: {
      bg: "#f8fafc", surface: "#ffffff", surface2: "#f1f5f9", ink: "#0f172a", inkMuted: "#475569",
      inkFaint: "#94a3b8", line: "#e2e8f0", lineSoft: "#edf1f5", accent: "#059669", accentInk: "#065f46",
      accentSoft: "#ecfdf5", accent2: "#b45309", accent2Soft: "#fffbeb", danger: "#dc2626", dangerSoft: "#fef2f2",
    },
    dark: {
      bg: "#0b1120", surface: "#111827", surface2: "#1e293b", ink: "#f1f5f9", inkMuted: "#94a3b8",
      inkFaint: "#64748b", line: "#2b3646", lineSoft: "#1c2534", accent: "#34d399", accentInk: "#a7f3d0",
      accentSoft: "#0f2b22", accent2: "#fbbf24", accent2Soft: "#3a2c0d", danger: "#f87171", dangerSoft: "#3a1414",
    },
  },
  shape: { borderWidth: 1, radius: 8 },
  font: { display: "sans", body: "sans", mono: "mono" },
};

/**
 * Memphis: cream/butter ground, hot pink + teal + yellow accents, heavy black
 * borders, square corners and a blur-free pink offset shadow.
 */
export const memphisTheme: Theme = {
  schemaVersion: 1,
  id: "memphis",
  name: "Memphis",
  colors: {
    light: {
      bg: "#fff4d6", surface: "#ffffff", surface2: "#ffe8a3", ink: "#111111", inkMuted: "#3b3b3b",
      inkFaint: "#6b6b6b", line: "#111111", lineSoft: "#e6d9b0", accent: "#e6007e", accentInk: "#a3005a",
      accentSoft: "#ffd6ec", accent2: "#007f73", accent2Soft: "#c9f5ef", danger: "#d62828", dangerSoft: "#ffdada",
    },
    dark: {
      bg: "#14163a", surface: "#1e2159", surface2: "#2a2e7a", ink: "#fff4d6", inkMuted: "#c9c3e6",
      inkFaint: "#9a95c7", line: "#f3e9c6", lineSoft: "#3a3f94", accent: "#e6007e", accentInk: "#ffb3dd",
      accentSoft: "#4a1a45", accent2: "#2ee6d0", accent2Soft: "#0e3f45", danger: "#ff6b6b", dangerSoft: "#4a1a1f",
    },
  },
  shape: { borderWidth: 3, radius: 0, shadow: { x: 4, y: 4, color: "#ff3ea5" } },
  font: { display: "rounded-bold", body: "sans", mono: "mono" },
};

export const builtInThemes: Theme[] = [defaultTheme, memphisTheme];
```

Append to `packages/themes/src/index.ts`:
```ts
export * from "./builtin";
```

- [ ] **Step 4: Amend the spec (two facts changed during planning)**

In `docs/superpowers/specs/2026-09-19-installable-themes-design.md`:
1. Memphis section: replace the sentence "Dark variant: deep navy background, same saturated accents, light ink, light shadow colour kept visible against the dark background." with "Dark variant: deep navy background, same saturated accents, cream ink and borders. The shadow colour is a single hot pink (`#ff3ea5`) chosen to stay visible on both the cream and navy backgrounds, since `shape` is not mode-specific."
2. Desktop section: replace "The current `prefers-color-scheme` block in `globals.css` is replaced by the resolved mode, so the mode selector works." with "The `prefers-color-scheme` block in `globals.css` stays as a pre-hydration fallback (avoids a light flash for dark-mode users); inline variables from the resolved theme override it once the app mounts, so the mode selector works."

- [ ] **Step 5: Run tests and commit**

Run: `npm test -w @simplekasten/themes && npm run typecheck -w @simplekasten/themes`
Expected: PASS.

```bash
git add packages/themes/src docs/superpowers/specs/2026-09-19-installable-themes-design.md
git commit -m "Add built-in Default and Memphis themes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Theme storage helpers (install / list / remove)

**Files:**
- Create: `packages/themes/src/storage.ts`, `packages/themes/src/storage.test.ts`
- Modify: `packages/themes/src/index.ts`

**Interfaces:**
- Consumes: `parseTheme`, `RESERVED_THEME_IDS`, `Theme` (Tasks 1–2); `FileSystemAdapter` type from `@simplekasten/local-engine`
- Produces:
  - `interface InstalledThemes { themes: Theme[]; skipped: { file: string; errors: string[] }[] }`
  - `type InstallResult = { ok: true; theme: Theme } | { ok: false; errors: string[] }`
  - `listInstalledThemes(fs): Promise<InstalledThemes>`
  - `installTheme(fs, json: string): Promise<InstallResult>` (rejects reserved ids; overwrites same id)
  - `removeTheme(fs, id: string): Promise<void>` (no-op for unknown id)

- [ ] **Step 1: Write the failing test**

`packages/themes/src/storage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { FileSystemAdapter } from "@simplekasten/local-engine";
import { memphisTheme } from "./builtin";
import { installTheme, listInstalledThemes, removeTheme } from "./storage";

// Minimal in-memory FileSystemAdapter (local-engine's test helper isn't exported).
function memoryFs(): FileSystemAdapter {
  const files = new Map<string, string>();
  return {
    async listFiles(dir) {
      const prefix = `${dir}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/")).map((p) => p.slice(prefix.length));
    },
    async readFile(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },
    async writeFile(path, contents) { files.set(path, contents); },
    async deleteFile(path) { files.delete(path); },
    async exists(path) { return files.has(path); },
    async ensureDir() {},
    async copyFile(s, d) { files.set(d, files.get(s) ?? ""); },
    resolvePath: (p) => p,
  };
}

const custom = { ...memphisTheme, id: "sunset", name: "Sunset" };

describe("theme storage", () => {
  it("installs a valid theme and lists it", async () => {
    const fs = memoryFs();
    const result = await installTheme(fs, JSON.stringify(custom));
    expect(result.ok).toBe(true);
    const listed = await listInstalledThemes(fs);
    expect(listed.themes.map((t) => t.id)).toEqual(["sunset"]);
    expect(listed.skipped).toEqual([]);
  });

  it("rejects a reserved built-in id", async () => {
    const result = await installTheme(memoryFs(), JSON.stringify({ ...custom, id: "memphis" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/built-in/i);
  });

  it("returns validation errors and writes nothing for invalid JSON", async () => {
    const fs = memoryFs();
    const result = await installTheme(fs, "{nope");
    expect(result.ok).toBe(false);
    expect((await listInstalledThemes(fs)).themes).toEqual([]);
  });

  it("overwrites an existing theme with the same id", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await installTheme(fs, JSON.stringify({ ...custom, name: "Sunset v2" }));
    const listed = await listInstalledThemes(fs);
    expect(listed.themes).toHaveLength(1);
    expect(listed.themes[0].name).toBe("Sunset v2");
  });

  it("skips (and reports) invalid files on disk instead of failing", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await fs.writeFile("themes/broken.json", "{oops");
    await fs.writeFile("themes/readme.txt", "ignored");
    const listed = await listInstalledThemes(fs);
    expect(listed.themes.map((t) => t.id)).toEqual(["sunset"]);
    expect(listed.skipped.map((s) => s.file)).toEqual(["broken.json"]);
  });

  it("removes an installed theme and ignores unknown ids", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await removeTheme(fs, "sunset");
    await removeTheme(fs, "never-installed");
    expect((await listInstalledThemes(fs)).themes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @simplekasten/themes -- storage`
Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Implement**

`packages/themes/src/storage.ts`:
```ts
import type { FileSystemAdapter } from "@simplekasten/local-engine";
import { parseTheme } from "./parse";
import { RESERVED_THEME_IDS, type Theme } from "./schema";

const THEMES_DIR = "themes";

export interface InstalledThemes {
  themes: Theme[];
  skipped: { file: string; errors: string[] }[];
}

export type InstallResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

const themePath = (id: string) => `${THEMES_DIR}/${id}.json`;

export async function listInstalledThemes(fs: FileSystemAdapter): Promise<InstalledThemes> {
  const files = (await fs.listFiles(THEMES_DIR)).filter((f) => f.endsWith(".json")).sort();
  const themes: Theme[] = [];
  const skipped: InstalledThemes["skipped"] = [];

  for (const file of files) {
    try {
      const parsed = parseTheme(await fs.readFile(`${THEMES_DIR}/${file}`));
      if (parsed.ok) themes.push(parsed.theme);
      else skipped.push({ file, errors: parsed.errors });
    } catch (err) {
      skipped.push({ file, errors: [err instanceof Error ? err.message : "Could not read file"] });
    }
  }
  return { themes, skipped };
}

export async function installTheme(fs: FileSystemAdapter, json: string): Promise<InstallResult> {
  const parsed = parseTheme(json);
  if (!parsed.ok) return parsed;
  if (RESERVED_THEME_IDS.includes(parsed.theme.id)) {
    return { ok: false, errors: [`id: "${parsed.theme.id}" is a built-in theme id — pick a different id`] };
  }
  await fs.ensureDir(THEMES_DIR);
  await fs.writeFile(themePath(parsed.theme.id), JSON.stringify(parsed.theme, null, 2));
  return { ok: true, theme: parsed.theme };
}

export async function removeTheme(fs: FileSystemAdapter, id: string): Promise<void> {
  // id is validated against ^[a-z0-9-]{1,40}$ before it is ever used in a path.
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return;
  await fs.deleteFile(themePath(id));
}
```

Append to `packages/themes/src/index.ts`:
```ts
export * from "./storage";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -w @simplekasten/themes && npm run typecheck -w @simplekasten/themes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/themes/src
git commit -m "Add theme install/list/remove storage helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Desktop — CSS-variable mapping and main-process IPC

**Files:**
- Create: `apps/desktop/src/lib/themeRuntime.ts`, `apps/desktop/src/lib/themeRuntime.test.ts`, `apps/desktop/src/lib/themeClient.ts`
- Modify: `apps/desktop/package.json`, `apps/desktop/next.config.js`, `apps/desktop/main.js`, `apps/desktop/preload.js`, `apps/desktop/src/lib/vaultClient.ts`

**Interfaces:**
- Consumes: `ResolvedTheme`, `ColorKey`, `COLOR_KEYS`, `FontKeyword`, `Theme`, `ModePreference`, `InstallResult`, `InstalledThemes` (Tasks 1–3)
- Produces:
  - `themeToCssVars(theme: ResolvedTheme): Record<string, string | null>` (`null` = remove the inline override)
  - `applyThemeToDocument(theme: ResolvedTheme, root?: HTMLElement): void`
  - `FONT_STACKS: Record<FontKeyword, string>`
  - `themeClient`: `getSettings(): Promise<{ theme: string; themeMode: ModePreference }>`, `setSettings(patch: Partial<{ theme: string; themeMode: ModePreference }>): Promise<void>`, `listInstalled(): Promise<InstalledThemes>`, `installFromFile(): Promise<InstallOutcome>`, `installFromText(json: string): Promise<InstallOutcome>`, `remove(id: string): Promise<void>` where `type InstallOutcome = InstallResult | { ok: false; errors: string[]; canceled: true }`
  - Electron IPC channels: `settings:get`, `settings:set`, `themes:list`, `themes:install`, `themes:installFromText`, `themes:remove`; exposed as `window.simplekasten.settings.{get,set}` and `window.simplekasten.themes.{list,install,installFromText,remove}`

- [ ] **Step 1: Add the dependency and transpile config**

In `apps/desktop/package.json` `dependencies`, add `"@simplekasten/themes": "*",` (keep alphabetical: after `@simplekasten/local-engine`). Run `npm install` at the repo root.

`apps/desktop/next.config.js` — add `transpilePackages` inside `nextConfig`:
```js
  // Workspace packages ship TypeScript source (no build step); Next has to
  // compile them when the renderer imports them.
  transpilePackages: ["@simplekasten/themes"],
```

- [ ] **Step 2: Write the failing test**

`apps/desktop/src/lib/themeRuntime.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { defaultTheme, memphisTheme, resolveTheme } from "@simplekasten/themes";
import { applyThemeToDocument, themeToCssVars } from "./themeRuntime";

describe("themeToCssVars", () => {
  it("maps colour keys to the Tailwind --color-* variable names", () => {
    const vars = themeToCssVars(resolveTheme(defaultTheme, "light"));
    expect(vars["--color-bg"]).toBe("#f8fafc");
    expect(vars["--color-surface-2"]).toBe("#f1f5f9");
    expect(vars["--color-accent-2-soft"]).toBe("#fffbeb");
    expect(vars["--color-line-soft"]).toBe("#edf1f5");
  });

  it("derives a radius scale that reproduces Tailwind's defaults at radius 8", () => {
    const vars = themeToCssVars(resolveTheme(defaultTheme, "light"));
    expect(vars["--radius-sm"]).toBe("4px");
    expect(vars["--radius-md"]).toBe("6px");
    expect(vars["--radius-lg"]).toBe("8px");
    expect(vars["--radius-xl"]).toBe("12px");
    expect(vars["--radius-2xl"]).toBe("16px");
  });

  it("removes shadow overrides when the theme has no shadow (Tailwind defaults apply)", () => {
    const vars = themeToCssVars(resolveTheme(defaultTheme, "light"));
    expect(vars["--shadow-sm"]).toBeNull();
    expect(vars["--shadow-2xl"]).toBeNull();
  });

  it("emits hard, blur-free offset shadows for a themed shadow", () => {
    const vars = themeToCssVars(resolveTheme(memphisTheme, "light"));
    expect(vars["--shadow-md"]).toBe("4px 4px 0 #ff3ea5");
    expect(vars["--shadow-sm"]).toBe("2px 2px 0 #ff3ea5");
    expect(vars["--shadow-lg"]).toBe("6px 6px 0 #ff3ea5");
  });

  it("sets border width and font stacks", () => {
    const vars = themeToCssVars(resolveTheme(memphisTheme, "light"));
    expect(vars["--border-w"]).toBe("3px");
    expect(vars["--font-display"]).toContain("Arial Rounded MT Bold");
    expect(vars["--font-body"]).toContain("Inter");
    expect(vars["--font-mono"]).toContain("JetBrains Mono");
  });
});

describe("applyThemeToDocument", () => {
  it("writes variables inline, removes null ones, and sets color-scheme", () => {
    const root = document.createElement("html");
    root.style.setProperty("--shadow-md", "stale");
    applyThemeToDocument(resolveTheme(defaultTheme, "dark"), root);
    expect(root.style.getPropertyValue("--color-bg")).toBe("#0b1120");
    expect(root.style.getPropertyValue("--shadow-md")).toBe("");
    expect(root.style.colorScheme).toBe("dark");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -w @simplekasten/desktop -- themeRuntime`
Expected: FAIL — cannot resolve `./themeRuntime`.

- [ ] **Step 4: Implement `themeRuntime.ts`**

`apps/desktop/src/lib/themeRuntime.ts`:
```ts
import { COLOR_KEYS, type ColorKey, type FontKeyword, type ResolvedTheme } from "@simplekasten/themes";

const COLOR_VAR: Record<ColorKey, string> = {
  bg: "--color-bg",
  surface: "--color-surface",
  surface2: "--color-surface-2",
  ink: "--color-ink",
  inkMuted: "--color-ink-muted",
  inkFaint: "--color-ink-faint",
  line: "--color-line",
  lineSoft: "--color-line-soft",
  accent: "--color-accent",
  accentInk: "--color-accent-ink",
  accentSoft: "--color-accent-soft",
  accent2: "--color-accent-2",
  accent2Soft: "--color-accent-2-soft",
  danger: "--color-danger",
  dangerSoft: "--color-danger-soft",
};

export const FONT_STACKS: Record<FontKeyword, string> = {
  sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  "rounded-bold": '"Arial Rounded MT Bold", "Nunito", "Varela Round", ui-rounded, "Trebuchet MS", system-ui, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
};

// Tailwind v4's rounded-*/shadow-* utilities read --radius-* / --shadow-*, so
// overriding those variables reshapes every existing utility with no markup
// changes. Multipliers reproduce Tailwind's defaults at radius 8 (4/6/8/12/16px).
const RADIUS_SCALE: Record<string, number> = { sm: 0.5, md: 0.75, lg: 1, xl: 1.5, "2xl": 2 };
const SHADOW_SCALE: Record<string, number> = { sm: 0.5, md: 1, lg: 1.5, xl: 2, "2xl": 2.5 };

/** CSS variable name → value; `null` means "remove the inline override". */
export function themeToCssVars(theme: ResolvedTheme): Record<string, string | null> {
  const vars: Record<string, string | null> = {};

  for (const key of COLOR_KEYS) vars[COLOR_VAR[key]] = theme.colors[key];

  for (const [name, factor] of Object.entries(RADIUS_SCALE)) {
    vars[`--radius-${name}`] = `${theme.shape.radius * factor}px`;
  }

  vars["--border-w"] = `${theme.shape.borderWidth}px`;

  for (const [name, factor] of Object.entries(SHADOW_SCALE)) {
    const shadow = theme.shape.shadow;
    vars[`--shadow-${name}`] = shadow ? `${shadow.x * factor}px ${shadow.y * factor}px 0 ${shadow.color}` : null;
  }

  vars["--font-display"] = FONT_STACKS[theme.font.display];
  vars["--font-body"] = FONT_STACKS[theme.font.body];
  vars["--font-mono"] = FONT_STACKS[theme.font.mono];

  return vars;
}

export function applyThemeToDocument(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeToCssVars(theme))) {
    if (value === null) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  }
  root.style.colorScheme = theme.mode;
}
```

- [ ] **Step 5: Run the test**

Run: `npm test -w @simplekasten/desktop -- themeRuntime`
Expected: PASS.

- [ ] **Step 6: Main-process IPC**

In `apps/desktop/main.js`, after the `localEngine` requires add:
```js
const themesLib = require("@simplekasten/themes");
```
Inside the same function that registers the existing `ipcMain.handle("vault:…")` handlers (right after `vault:chooseVaultFolder`'s handler), add:
```js
  // ---- Themes & appearance settings -------------------------------------
  const THEME_MODES = ["system", "light", "dark"];
  const MAX_THEME_FILE_BYTES = 256 * 1024;

  ipcMain.handle("settings:get", () => {
    const s = loadSettings();
    return {
      theme: typeof s.theme === "string" ? s.theme : "default",
      themeMode: THEME_MODES.includes(s.themeMode) ? s.themeMode : "system",
    };
  });

  ipcMain.handle("settings:set", (_event, patch) => {
    const next = { ...loadSettings() };
    if (typeof patch?.theme === "string") next.theme = patch.theme;
    if (THEME_MODES.includes(patch?.themeMode)) next.themeMode = patch.themeMode;
    saveSettings(next);
  });

  ipcMain.handle("themes:list", () => themesLib.listInstalledThemes(currentAdapter()));
  ipcMain.handle("themes:installFromText", (_event, json) =>
    themesLib.installTheme(currentAdapter(), typeof json === "string" ? json : ""),
  );
  ipcMain.handle("themes:remove", (_event, id) => themesLib.removeTheme(currentAdapter(), String(id)));
  ipcMain.handle("themes:install", async () => {
    const result = await dialog.showOpenDialog({
      title: "Install theme",
      properties: ["openFile"],
      filters: [{ name: "Theme (JSON)", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, errors: [], canceled: true };

    const file = result.filePaths[0];
    if (fs.statSync(file).size > MAX_THEME_FILE_BYTES) {
      return { ok: false, errors: ["File is too large to be a theme (max 256 KB)"] };
    }
    return themesLib.installTheme(currentAdapter(), fs.readFileSync(file, "utf8"));
  });
```
(If the existing handlers are registered at module top level rather than inside a function, place this block alongside them at the same level.)

In `apps/desktop/preload.js`, extend the exposed object (add after the `vault: {…}` entry, inside `exposeInMainWorld`):
```js
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (patch) => ipcRenderer.invoke("settings:set", patch),
  },
  themes: {
    list: () => ipcRenderer.invoke("themes:list"),
    install: () => ipcRenderer.invoke("themes:install"),
    installFromText: (json) => ipcRenderer.invoke("themes:installFromText", json),
    remove: (id) => ipcRenderer.invoke("themes:remove", id),
  },
```

- [ ] **Step 7: Renderer typing and client**

In `apps/desktop/src/lib/vaultClient.ts`, add to the `import` section (top of file):
```ts
import type { InstalledThemes, InstallResult, ModePreference } from "@simplekasten/themes";
```
and extend the `simplekasten` type in `declare global` (next to `vault: {…}`):
```ts
      settings: {
        get: () => Promise<{ theme: string; themeMode: ModePreference }>;
        set: (patch: Partial<{ theme: string; themeMode: ModePreference }>) => Promise<void>;
      };
      themes: {
        list: () => Promise<InstalledThemes>;
        install: () => Promise<InstallResult | { ok: false; errors: string[]; canceled: true }>;
        installFromText: (json: string) => Promise<InstallResult>;
        remove: (id: string) => Promise<void>;
      };
```
(Adding an `import` turns the file into a module, which `declare global` already requires — it is one already because of `export const vaultClient`.)

`apps/desktop/src/lib/themeClient.ts`:
```ts
import type { InstalledThemes, InstallResult, ModePreference } from "@simplekasten/themes";

export type InstallOutcome = InstallResult | { ok: false; errors: string[]; canceled: true };
export interface AppearanceSettings {
  theme: string;
  themeMode: ModePreference;
}

const DEFAULTS: AppearanceSettings = { theme: "default", themeMode: "system" };

// The bridge only exists inside Electron. Guarding here keeps the renderer
// usable in a plain browser (dev/tests) with the Default theme.
function bridge() {
  return typeof window === "undefined" ? undefined : window.simplekasten;
}

export const themeClient = {
  async getSettings(): Promise<AppearanceSettings> {
    return (await bridge()?.settings?.get()) ?? DEFAULTS;
  },
  async setSettings(patch: Partial<AppearanceSettings>): Promise<void> {
    await bridge()?.settings?.set(patch);
  },
  async listInstalled(): Promise<InstalledThemes> {
    return (await bridge()?.themes?.list()) ?? { themes: [], skipped: [] };
  },
  async installFromFile(): Promise<InstallOutcome> {
    return (await bridge()?.themes?.install()) ?? { ok: false, errors: ["Theme install needs the desktop app"] };
  },
  async installFromText(json: string): Promise<InstallOutcome> {
    return (await bridge()?.themes?.installFromText(json)) ?? { ok: false, errors: ["Theme install needs the desktop app"] };
  },
  async remove(id: string): Promise<void> {
    await bridge()?.themes?.remove(id);
  },
};
```

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck -w @simplekasten/desktop && npm test -w @simplekasten/desktop`
Expected: clean; all desktop tests PASS.

```bash
git add apps/desktop/package.json apps/desktop/next.config.js apps/desktop/main.js apps/desktop/preload.js apps/desktop/src/lib package-lock.json
git commit -m "Desktop: theme CSS-variable runtime and main-process theme IPC

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Desktop — ThemeProvider and app wiring

**Files:**
- Create: `apps/desktop/src/lib/ThemeProvider.tsx`
- Modify: `apps/desktop/src/app/layout.tsx`

**Interfaces:**
- Consumes: `themeClient`, `applyThemeToDocument` (Task 4); `builtInThemes`, `defaultTheme`, `resolveTheme`, `resolveModePreference`, `Theme`, `ResolvedTheme`, `ModePreference` (Tasks 1–2)
- Produces:
  - `interface ThemeContextValue { themes: Theme[]; activeId: string; mode: ModePreference; resolved: ResolvedTheme; notice: string | null; setTheme(id: string): Promise<void>; setMode(mode: ModePreference): Promise<void>; installFromFile(): Promise<InstallOutcome>; installFromText(json: string): Promise<InstallOutcome>; remove(id: string): Promise<void> }`
  - `ThemeContext` (exported so tests can supply a fake value), `ThemeProvider({ children })`, `useTheme(): ThemeContextValue`

- [ ] **Step 1: Implement the provider**

`apps/desktop/src/lib/ThemeProvider.tsx`:
```tsx
"use client";

import {
  builtInThemes,
  defaultTheme,
  resolveModePreference,
  resolveTheme,
  type ModePreference,
  type ResolvedTheme,
  type Theme,
} from "@simplekasten/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { themeClient, type InstallOutcome } from "./themeClient";
import { applyThemeToDocument } from "./themeRuntime";

export interface ThemeContextValue {
  themes: Theme[];
  activeId: string;
  mode: ModePreference;
  resolved: ResolvedTheme;
  /** Set when the saved theme couldn't be loaded and Default was used instead. */
  notice: string | null;
  setTheme(id: string): Promise<void>;
  setMode(mode: ModePreference): Promise<void>;
  installFromFile(): Promise<InstallOutcome>;
  installFromText(json: string): Promise<InstallOutcome>;
  remove(id: string): Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [mode, setModeState] = useState<ModePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const themes = useMemo(() => [...builtInThemes, ...installed], [installed]);
  const active = themes.find((t) => t.id === activeId) ?? defaultTheme;
  const resolved = useMemo(
    () => resolveTheme(active, resolveModePreference(mode, systemDark)),
    [active, mode, systemDark],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settings, list] = await Promise.all([themeClient.getSettings(), themeClient.listInstalled()]);
      if (cancelled) return;
      setInstalled(list.themes);
      setModeState(settings.themeMode);
      setActiveId(settings.theme);
      const known = [...builtInThemes, ...list.themes].some((t) => t.id === settings.theme);
      if (!known) setNotice(`Theme "${settings.theme}" could not be loaded, so Default is being used.`);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  const setTheme = useCallback(async (id: string) => {
    setActiveId(id);
    setNotice(null);
    await themeClient.setSettings({ theme: id });
  }, []);

  const setMode = useCallback(async (next: ModePreference) => {
    setModeState(next);
    await themeClient.setSettings({ themeMode: next });
  }, []);

  const refreshInstalled = useCallback(async () => {
    setInstalled((await themeClient.listInstalled()).themes);
  }, []);

  const installFromFile = useCallback(async () => {
    const outcome = await themeClient.installFromFile();
    if (outcome.ok) await refreshInstalled();
    return outcome;
  }, [refreshInstalled]);

  const installFromText = useCallback(
    async (json: string) => {
      const outcome = await themeClient.installFromText(json);
      if (outcome.ok) await refreshInstalled();
      return outcome;
    },
    [refreshInstalled],
  );

  const remove = useCallback(
    async (id: string) => {
      await themeClient.remove(id);
      await refreshInstalled();
      // Removing the active theme falls back to Default (and persists that).
      if (id === activeId) await setTheme("default");
    },
    [activeId, refreshInstalled, setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ themes, activeId, mode, resolved, notice, setTheme, setMode, installFromFile, installFromText, remove }),
    [themes, activeId, mode, resolved, notice, setTheme, setMode, installFromFile, installFromText, remove],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 2: Mount it in the layout**

Read `apps/desktop/src/app/layout.tsx`, then wrap `{children}` in `<ThemeProvider>` (import from `../lib/ThemeProvider`). `layout.tsx` stays a Server Component — the provider is a client component, which is allowed.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w @simplekasten/desktop`
Expected: clean.

- [ ] **Step 4: Verify in a browser with Playwright (Default theme unchanged, no regressions)**

1. `cd apps/desktop && (npx next dev -p 3111 > /tmp/next.log 2>&1 &)`; wait until `tail /tmp/next.log` shows Ready.
2. With `browser_run_code_unsafe`, `addInitScript` a stub of `window.simplekasten` (`vault` with a couple of notes as in earlier sessions, plus `settings.get → {theme:"memphis", themeMode:"light"}`, `settings.set → ()`, `themes.list → {themes:[], skipped:[]}`), navigate to `http://localhost:3111`, wait 3s.
3. Assert with `page.evaluate`: `getComputedStyle(document.documentElement).getPropertyValue("--color-bg")` is `#fff4d6` and the `<body>` computed `background-color` is `rgb(255, 244, 214)`.
4. Screenshot; confirm the page is cream, not the default slate. Then repeat with `settings.get → {theme:"default", themeMode:"dark"}` and confirm `--color-bg` is `#0b1120`.
5. Stop the dev server (find the PID on port 3111 with `netstat -ano | grep :3111` and `taskkill //F //PID <pid>`), delete screenshots.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/ThemeProvider.tsx apps/desktop/src/app/layout.tsx
git commit -m "Desktop: ThemeProvider applies the active theme on mount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Desktop — theme border width through existing components

Tailwind v4 has no variable for the plain `border` width, so it needs a markup change (unlike radius/shadow, which Task 4 already reshapes through `--radius-*`/`--shadow-*`).

**Files:**
- Modify: `apps/desktop/src/components/ui.tsx`, `QuickSwitcher.tsx`, `GraphView.tsx`, `apps/desktop/src/app/page.tsx`

**Interfaces:**
- Consumes: `--border-w` CSS variable (Task 4)
- Produces: every full-box `border` utility in the desktop renderer reads `--border-w`

- [ ] **Step 1: List the occurrences**

Run (Grep tool, output mode content): pattern `(?<![\w-])border(?![\w-])` in `apps/desktop/src/**/*.tsx`, excluding `*.test.tsx`. Only class-name occurrences matter. `border-b`, `border-l-2`, `border-line`, `border-transparent` etc. are different classes and are untouched (dividers stay 1px by design; the heavy Memphis borders belong on boxes: buttons, inputs, cards, modals).

- [ ] **Step 2: Replace each standalone `border` class**

In every className string, change the standalone token `border` to `border-(length:--border-w)` (keep any accompanying `border-line` / `border-danger/30` colour classes). Example in `ui.tsx`:
```
secondary: "border border-line bg-surface …"   →   "border-(length:--border-w) border-line bg-surface …"
```
Do it with individual Edit calls per occurrence (there are ~15); do not use a global regex, which would also rewrite the word in comments and text.

- [ ] **Step 3: Typecheck and existing tests**

Run: `npm run typecheck -w @simplekasten/desktop && npm test -w @simplekasten/desktop`
Expected: clean; the existing `QuickSwitcher.test.tsx` still passes.

- [ ] **Step 4: Verify in Playwright — Default is pixel-equivalent, Memphis is chunky**

Start `next dev -p 3111` and stub as in Task 5. For each of `{theme:"default"}` and `{theme:"memphis"}`:
- `page.evaluate` computed style of the "Jump to…" button: `borderTopWidth` must be `1px` for default, `3px` for memphis; `borderTopLeftRadius` `8px` vs `0px`; `boxShadow` must be `none` for the default sidebar buttons and contain `rgb(255, 62, 165)` for the memphis primary button ("+ New note", which uses `shadow-sm`).
- Screenshot both and read them. If `rounded-lg`/`shadow-sm` did **not** follow the variables (Tailwind v4 minor versions differ), stop and report it — do not paper over it — the fallback is adding `--radius-*`/`--shadow-*` to the `@theme` block in `globals.css` so utilities are generated against variables.
Stop the server, delete screenshots.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ui.tsx apps/desktop/src/components/QuickSwitcher.tsx apps/desktop/src/components/GraphView.tsx apps/desktop/src/app/page.tsx
git commit -m "Desktop: drive box border width from the active theme

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Desktop — Settings modal

**Files:**
- Create: `apps/desktop/src/components/SettingsModal.tsx`, `apps/desktop/src/components/SettingsModal.test.tsx`
- Modify: `apps/desktop/src/components/icons.tsx`, `apps/desktop/src/app/page.tsx`

**Interfaces:**
- Consumes: `ThemeContext`, `ThemeContextValue`, `useTheme` (Task 5); `Button`, `IconButton`, `SegmentedControl` from `ui.tsx`; `XIcon` from `icons.tsx`; `resolveTheme` (Task 1)
- Produces: `SettingsModal({ onClose }: { onClose: () => void })`; `SettingsIcon` in `icons.tsx`

- [ ] **Step 1: Write the failing test**

`apps/desktop/src/components/SettingsModal.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { builtInThemes, memphisTheme, resolveTheme, type Theme } from "@simplekasten/themes";
import { describe, expect, it, vi } from "vitest";
import { ThemeContext, type ThemeContextValue } from "../lib/ThemeProvider";
import { SettingsModal } from "./SettingsModal";

const sunset: Theme = { ...memphisTheme, id: "sunset", name: "Sunset" };

function renderModal(overrides: Partial<ThemeContextValue> = {}) {
  const value: ThemeContextValue = {
    themes: [...builtInThemes, sunset],
    activeId: "default",
    mode: "system",
    resolved: resolveTheme(builtInThemes[0], "light"),
    notice: null,
    setTheme: vi.fn(async () => {}),
    setMode: vi.fn(async () => {}),
    installFromFile: vi.fn(async () => ({ ok: false as const, errors: [], canceled: true as const })),
    installFromText: vi.fn(async () => ({ ok: true as const, theme: sunset })),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
  const onClose = vi.fn();
  render(
    <ThemeContext.Provider value={value}>
      <SettingsModal onClose={onClose} />
    </ThemeContext.Provider>,
  );
  return { value, onClose };
}

describe("SettingsModal", () => {
  it("lists built-in and installed themes with the active one selected", () => {
    renderModal();
    expect(screen.getByRole("radio", { name: /default/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /memphis/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /sunset/i })).toBeInTheDocument();
  });

  it("selects a theme", () => {
    const { value } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: /memphis/i }));
    expect(value.setTheme).toHaveBeenCalledWith("memphis");
  });

  it("changes the mode", () => {
    const { value } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /^dark$/i }));
    expect(value.setMode).toHaveBeenCalledWith("dark");
  });

  it("only offers Remove for installed themes", () => {
    const { value } = renderModal();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /remove sunset/i }));
    expect(value.remove).toHaveBeenCalledWith("sunset");
  });

  it("installs pasted JSON and shows validation errors inline", async () => {
    const { value } = renderModal({
      installFromText: vi.fn(async () => ({ ok: false as const, errors: ["colors.light.accent: must be a #rgb or #rrggbb colour"] })),
    });
    fireEvent.click(screen.getByRole("button", { name: /paste json/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /theme json/i }), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("colors.light.accent"));
    expect(value.installFromText).toHaveBeenCalledWith("{}");
  });

  it("shows the fallback notice when present", () => {
    renderModal({ notice: 'Theme "gone" could not be loaded, so Default is being used.' });
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @simplekasten/desktop -- SettingsModal`
Expected: FAIL — cannot resolve `./SettingsModal`.

- [ ] **Step 3: Add the gear icon**

Read `apps/desktop/src/components/icons.tsx` and add a `SettingsIcon` following the exact same pattern as its neighbours (same wrapper/props/stroke style). Use the standard Lucide "settings" glyph paths.

- [ ] **Step 4: Implement the modal**

Read `apps/desktop/src/components/ui.tsx` for the exact `SegmentedControl` props (`value`, `onChange`, `options: {value,label}[]`), then create `apps/desktop/src/components/SettingsModal.tsx`:
```tsx
"use client";

import { resolveTheme, type ModePreference, type Theme } from "@simplekasten/themes";
import { useEffect, useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { XIcon } from "./icons";
import { Button, IconButton, SegmentedControl } from "./ui";

const BUILT_IN_IDS = ["default", "memphis"];

function Swatch({ theme }: { theme: Theme }) {
  const colors = resolveTheme(theme, "light").colors;
  return (
    <span className="flex flex-none overflow-hidden rounded-md border-(length:--border-w) border-line" aria-hidden>
      {[colors.bg, colors.accent, colors.accent2].map((c) => (
        <span key={c} className="h-6 w-4" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { themes, activeId, mode, notice, setTheme, setMode, installFromFile, installFromText, remove } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleFile() {
    const outcome = await installFromFile();
    if (outcome.ok) setErrors([]);
    else if (!("canceled" in outcome && outcome.canceled)) setErrors(outcome.errors);
  }

  async function handlePaste() {
    const outcome = await installFromText(json);
    if (outcome.ok) {
      setErrors([]);
      setJson("");
      setPasting(false);
    } else {
      setErrors(outcome.errors);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        className="animate-fade-scale-in w-full max-w-lg overflow-hidden rounded-2xl border-(length:--border-w) border-line bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-bold text-ink">Settings</h2>
          <IconButton aria-label="Close settings" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <h3 className="mb-2 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">Theme</h3>

          {notice && (
            <p role="status" className="mb-3 rounded-lg bg-accent2-soft px-3 py-2 text-sm text-accent-2">
              {notice}
            </p>
          )}

          <ul className="mb-4 flex flex-col gap-1.5">
            {themes.map((theme) => {
              const builtIn = BUILT_IN_IDS.includes(theme.id);
              return (
                <li key={theme.id} className="flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-(length:--border-w) border-line px-3 py-2 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input
                      type="radio"
                      name="theme"
                      className="accent-accent"
                      checked={activeId === theme.id}
                      onChange={() => setTheme(theme.id)}
                    />
                    <Swatch theme={theme} />
                    <span className="flex-1">{theme.name}</span>
                    <span className="font-mono text-[10px] text-ink-faint">{builtIn ? "built-in" : (theme.author ?? "installed")}</span>
                  </label>
                  {!builtIn && (
                    <Button variant="ghost" size="sm" aria-label={`Remove ${theme.name}`} onClick={() => remove(theme.id)}>
                      Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          <h3 className="mb-2 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">Appearance</h3>
          <div className="mb-4">
            <SegmentedControl<ModePreference>
              value={mode}
              onChange={setMode}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>

          <h3 className="mb-2 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">Install a theme</h3>
          <div className="flex gap-2">
            <Button onClick={handleFile}>Install theme…</Button>
            <Button variant="ghost" onClick={() => setPasting((p) => !p)}>
              Paste JSON
            </Button>
          </div>

          {pasting && (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                aria-label="Theme JSON"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full rounded-lg border-(length:--border-w) border-line bg-surface p-2 font-mono text-xs text-ink outline-none focus:border-accent"
              />
              <div>
                <Button variant="primary" onClick={handlePaste}>
                  Install
                </Button>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <ul role="alert" className="mt-3 list-disc rounded-lg bg-danger-soft py-2 pr-3 pl-7 text-sm text-danger">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```
If `SegmentedControl` is not generic, drop the `<ModePreference>` type argument and cast in `onChange`. If its option buttons are not `role="button"` with the label as accessible name, adjust the `Dark` assertion in the test to match how it actually renders — do not weaken the assertion.

- [ ] **Step 5: Run the tests**

Run: `npm test -w @simplekasten/desktop -- SettingsModal`
Expected: all 7 PASS. Then `npm run typecheck -w @simplekasten/desktop`.

- [ ] **Step 6: Wire the gear button into the sidebar**

In `apps/desktop/src/app/page.tsx`:
- Import `SettingsModal`, `SettingsIcon`, `useTheme`.
- Add `const [settingsOpen, setSettingsOpen] = useState(false);` next to the existing `switcherOpen` state, and `const { notice } = useTheme();`.
- In the sidebar button stack (the `flex flex-col gap-1` block containing "Jump to…", "Graph view", "+ New note"), add above "Jump to…" — or as a bottom-of-sidebar row if there is one — a button styled like "Graph view":
```tsx
          <button
            onClick={() => setSettingsOpen(true)}
            className="relative flex items-center gap-2 rounded-lg border-(length:--border-w) border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-faint transition-colors hover:border-accent/50 hover:text-ink-muted"
          >
            <SettingsIcon />
            Settings
            {notice && <span aria-label="Theme problem" className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-accent-2" />}
          </button>
```
- Render `{settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}` beside the existing `QuickSwitcher`/`GraphView` conditional renders.

- [ ] **Step 7: Verify end-to-end with Playwright**

Start `next dev -p 3111`. Stub `window.simplekasten` in `addInitScript` **with a stateful theme bridge** (in-memory `settings` and `installed` array; `themes.installFromText` runs a tiny check: parse JSON, return `{ok:true,theme}` and push, or `{ok:false,errors:["Not valid JSON"]}`; `themes.install` returns `{ok:false,errors:[],canceled:true}`), plus the vault stub used previously.
1. Load the page → default theme. Screenshot #1.
2. Click **Settings** → modal visible with Default and Memphis, Default checked. Screenshot #2.
3. Click the Memphis radio → assert `--color-bg` on `<html>` becomes `#fff4d6`, "+ New note" button box-shadow contains `rgb(255, 62, 165)`, and the stub's persisted `settings.theme === "memphis"`. Screenshot #3 (whole app in Memphis).
4. Click **Dark** → assert `--color-bg` becomes `#14163a` and `<html>` style `color-scheme` is `dark`. Screenshot #4.
5. Click **Paste JSON**, type `{nope`, **Install** → `role=alert` shows "Not valid JSON".
6. Paste a valid custom theme JSON (Memphis copy with `id:"sunset"`, name `Sunset`) → it appears in the list with a Remove button; pick it; remove it → active theme falls back to Default.
7. Press Escape → modal closes.
Read every screenshot. Stop the server, delete screenshots.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/components/SettingsModal.tsx apps/desktop/src/components/SettingsModal.test.tsx apps/desktop/src/components/icons.tsx apps/desktop/src/app/page.tsx
git commit -m "Desktop: Settings modal with theme picker, mode and install

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Mobile — theme runtime, Settings screen, install

**Files:**
- Create: `apps/mobile/src/lib/settings.ts`, `apps/mobile/src/components/ThemeProvider.tsx`, `apps/mobile/src/components/HardShadow.tsx`, `apps/mobile/src/app/settings.tsx`
- Modify: `apps/mobile/package.json`, `apps/mobile/src/theme.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/vault/index.tsx`, `apps/mobile/src/lib/vault.ts`

**Interfaces:**
- Consumes: everything exported from `@simplekasten/themes`; `fs` from `apps/mobile/src/lib/vault.ts`
- Produces:
  - `vault.listThemes(): Promise<InstalledThemes>`, `vault.installTheme(json): Promise<InstallResult>`, `vault.removeTheme(id): Promise<void>` (added to the `vault` object)
  - `loadAppearance(): Promise<{ theme: string; themeMode: ModePreference }>`, `saveAppearance(patch): Promise<void>`
  - `ThemeProvider`, `useTheme(): { colors: Record<ColorKey,string>; shape: ResolvedTheme["shape"]; font: ResolvedTheme["font"]; resolved: ResolvedTheme; themes: Theme[]; activeId: string; mode: ModePreference; notice: string | null; setTheme; setMode; install(json: string): Promise<InstallResult>; installFromFile(): Promise<InstallResult | { ok: false; errors: string[]; canceled: true }>; remove(id: string): Promise<void> }`
  - `useThemeColors()` keeps its name and keeps returning the colours object (now `Record<ColorKey,string>`, a superset of today's keys), so existing screens keep working
  - `HardShadow({ children, style })`

- [ ] **Step 1: Dependencies**

In `apps/mobile/package.json` add `"@simplekasten/themes": "*"`. Then run, from `apps/mobile`: `npx expo install expo-document-picker` (lets Expo pick the SDK-57-compatible version). Then `npm install` at the repo root. Confirm `git diff apps/mobile/package.json` shows both additions.

- [ ] **Step 2: Vault helpers**

In `apps/mobile/src/lib/vault.ts` add `import { installTheme, listInstalledThemes, removeTheme } from "@simplekasten/themes";` and extend the `vault` object:
```ts
  listThemes: () => listInstalledThemes(fs),
  installTheme: (json: string) => installTheme(fs, json),
  removeTheme: (id: string) => removeTheme(fs, id),
```

- [ ] **Step 3: Settings persistence**

`apps/mobile/src/lib/settings.ts`:
```ts
import * as FileSystem from "expo-file-system/legacy";
import type { ModePreference } from "@simplekasten/themes";

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;
const MODES: ModePreference[] = ["system", "light", "dark"];

export interface AppearanceSettings {
  theme: string;
  themeMode: ModePreference;
}

const DEFAULTS: AppearanceSettings = { theme: "default", themeMode: "system" };

async function readAll(): Promise<Record<string, unknown>> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
    if (!info.exists) return {};
    return JSON.parse(await FileSystem.readAsStringAsync(SETTINGS_PATH));
  } catch {
    return {};
  }
}

export async function loadAppearance(): Promise<AppearanceSettings> {
  const s = await readAll();
  return {
    theme: typeof s.theme === "string" ? s.theme : DEFAULTS.theme,
    themeMode: MODES.includes(s.themeMode as ModePreference) ? (s.themeMode as ModePreference) : DEFAULTS.themeMode,
  };
}

export async function saveAppearance(patch: Partial<AppearanceSettings>): Promise<void> {
  const next = { ...(await readAll()), ...patch };
  await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify(next, null, 2));
}
```

- [ ] **Step 4: Provider**

`apps/mobile/src/components/ThemeProvider.tsx` — mirrors the desktop provider's logic (same fallback rule, same remove-active-falls-back-to-default rule), using `useColorScheme()` for `system` and `vault.*`/`settings.ts`:
```tsx
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  builtInThemes,
  defaultTheme,
  resolveModePreference,
  resolveTheme,
  type InstallResult,
  type ModePreference,
  type ResolvedTheme,
  type Theme,
} from "@simplekasten/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { loadAppearance, saveAppearance } from "@/lib/settings";
import { vault } from "@/lib/vault";

const MAX_THEME_FILE_BYTES = 256 * 1024;

type InstallOutcome = InstallResult | { ok: false; errors: string[]; canceled: true };

interface ThemeContextValue {
  colors: ResolvedTheme["colors"];
  shape: ResolvedTheme["shape"];
  font: ResolvedTheme["font"];
  resolved: ResolvedTheme;
  themes: Theme[];
  activeId: string;
  mode: ModePreference;
  notice: string | null;
  setTheme(id: string): Promise<void>;
  setMode(mode: ModePreference): Promise<void>;
  install(json: string): Promise<InstallResult>;
  installFromFile(): Promise<InstallOutcome>;
  remove(id: string): Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Before the provider has loaded (or in a screen rendered outside it) fall
// back to Default so components never crash.
const FALLBACK = resolveTheme(defaultTheme, "light");

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useColorScheme() === "dark";
  const [installed, setInstalled] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [mode, setModeState] = useState<ModePreference>("system");
  const [notice, setNotice] = useState<string | null>(null);

  const themes = useMemo(() => [...builtInThemes, ...installed], [installed]);
  const active = themes.find((t) => t.id === activeId) ?? defaultTheme;
  const resolved = useMemo(
    () => resolveTheme(active, resolveModePreference(mode, systemDark)),
    [active, mode, systemDark],
  );

  useEffect(() => {
    (async () => {
      const [settings, list] = await Promise.all([loadAppearance(), vault.listThemes()]);
      setInstalled(list.themes);
      setModeState(settings.themeMode);
      setActiveId(settings.theme);
      const known = [...builtInThemes, ...list.themes].some((t) => t.id === settings.theme);
      if (!known) setNotice(`Theme "${settings.theme}" could not be loaded, so Default is being used.`);
    })().catch(() => {});
  }, []);

  const refreshInstalled = useCallback(async () => setInstalled((await vault.listThemes()).themes), []);

  const setTheme = useCallback(async (id: string) => {
    setActiveId(id);
    setNotice(null);
    await saveAppearance({ theme: id });
  }, []);

  const setMode = useCallback(async (next: ModePreference) => {
    setModeState(next);
    await saveAppearance({ themeMode: next });
  }, []);

  const install = useCallback(
    async (json: string) => {
      const result = await vault.installTheme(json);
      if (result.ok) await refreshInstalled();
      return result;
    },
    [refreshInstalled],
  );

  const installFromFile = useCallback(async (): Promise<InstallOutcome> => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || picked.assets.length === 0) return { ok: false, errors: [], canceled: true };

    const asset = picked.assets[0];
    if ((asset.size ?? 0) > MAX_THEME_FILE_BYTES) {
      return { ok: false, errors: ["File is too large to be a theme (max 256 KB)"] };
    }
    return install(await FileSystem.readAsStringAsync(asset.uri));
  }, [install]);

  const remove = useCallback(
    async (id: string) => {
      await vault.removeTheme(id);
      await refreshInstalled();
      if (id === activeId) await setTheme("default");
    },
    [activeId, refreshInstalled, setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolved.colors, shape: resolved.shape, font: resolved.font, resolved,
      themes, activeId, mode, notice, setTheme, setMode, install, installFromFile, remove,
    }),
    [resolved, themes, activeId, mode, notice, setTheme, setMode, install, installFromFile, remove],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { FALLBACK as fallbackResolvedTheme };
```
(If `FALLBACK` ends up unused after typecheck, delete it and the export — do not leave dead code.)

- [ ] **Step 5: Replace `theme.ts`**

`apps/mobile/src/theme.ts` becomes a thin re-export so every existing `import { useThemeColors } from "@/theme"` keeps working:
```ts
import { useTheme } from "@/components/ThemeProvider";

// Colours now come from the active shared theme (packages/themes) instead of
// two hand-copied palettes — same keys, plus bg/lineSoft/danger/dangerSoft.
export function useThemeColors() {
  return useTheme().colors;
}

export { useTheme };
```
Run `Grep` for `lightColors|darkColors|ThemeColors` in `apps/mobile/src`; if anything else imports them, convert those uses to `useThemeColors()` / `ResolvedTheme["colors"]`.

- [ ] **Step 6: HardShadow**

`apps/mobile/src/components/HardShadow.tsx`:
```tsx
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/components/ThemeProvider";

/**
 * React Native has no blur-free offset box-shadow, so a themed hard shadow is
 * a coloured view offset behind the content. The wrapper reserves the offset
 * as padding so nothing overlaps neighbouring layout.
 */
export function HardShadow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { shape } = useTheme();
  const shadow = shape.shadow;
  if (!shadow) return <View style={style}>{children}</View>;

  return (
    <View style={[style, { paddingRight: shadow.x, paddingBottom: shadow.y }]}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: shadow.x,
          top: shadow.y,
          right: 0,
          bottom: 0,
          backgroundColor: shadow.color,
          borderRadius: shape.radius,
        }}
      />
      {children}
    </View>
  );
}
```

- [ ] **Step 7: Layout, gear button and screen**

`apps/mobile/src/app/_layout.tsx` — wrap the `Stack` in `<ThemeProvider>` (`useThemeColors()` must be called from a component *inside* the provider, so split into `export default function RootLayout() { return <ThemeProvider><ThemedStack /></ThemeProvider>; }` with the current body moved into `ThemedStack`). Add to the vault index screen options a gear header button and register the modal screen:
```tsx
      <Stack.Screen
        name="vault/index"
        options={{
          title: "Simplekasten",
          headerRight: () => (
            <Link href="/settings" accessibilityLabel="Settings" style={{ color: colors.ink, fontSize: 20, paddingHorizontal: 8 }}>
              ⚙
            </Link>
          ),
        }}
      />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
      <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
```
(import `Link` from `expo-router`.) Also apply the theme font and header border: `headerTitleStyle: { fontWeight: shape.borderWidth > 1 ? "800" : "600" }` is optional — skip; keep the header change to what's listed.

`apps/mobile/src/app/settings.tsx` — screen with the same content as the desktop modal, in React Native:
```tsx
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ModePreference } from "@simplekasten/themes";
import { HardShadow } from "@/components/HardShadow";
import { useTheme } from "@/components/ThemeProvider";

const BUILT_IN_IDS = ["default", "memphis"];
const MODES: { value: ModePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const { themes, activeId, mode, notice, colors, shape, setTheme, setMode, install, installFromFile, remove } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFile() {
    const outcome = await installFromFile();
    if (outcome.ok) setErrors([]);
    else if (!("canceled" in outcome)) setErrors(outcome.errors);
  }

  async function handlePaste() {
    const outcome = await install(json);
    if (outcome.ok) {
      setErrors([]);
      setJson("");
      setPasting(false);
    } else setErrors(outcome.errors);
  }

  const box = { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line };
  const heading = { color: colors.inkFaint, fontSize: 12, letterSpacing: 1, marginBottom: 8, marginTop: 20 } as const;

  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={{ padding: 16 }}>
      {notice && (
        <Text style={{ color: colors.accent2, backgroundColor: colors.accent2Soft, padding: 10, borderRadius: shape.radius }}>{notice}</Text>
      )}

      <Text style={heading}>THEME</Text>
      {themes.map((theme) => {
        const selected = activeId === theme.id;
        const builtIn = BUILT_IN_IDS.includes(theme.id);
        return (
          <View key={theme.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <HardShadow>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTheme(theme.id)}
                  style={[box, { padding: 12, backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.line }]}
                >
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {selected ? "● " : "○ "}
                    {theme.name}
                  </Text>
                  <Text style={{ color: colors.inkFaint, fontSize: 11 }}>{builtIn ? "built-in" : (theme.author ?? "installed")}</Text>
                </Pressable>
              </HardShadow>
            </View>
            {!builtIn && (
              <Pressable
                accessibilityLabel={`Remove ${theme.name}`}
                onPress={() => Alert.alert("Remove theme?", theme.name, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => remove(theme.id) }])}
              >
                <Text style={{ color: colors.inkMuted }}>Remove</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Text style={heading}>APPEARANCE</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            accessibilityRole="button"
            onPress={() => setMode(m.value)}
            style={[box, { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: mode === m.value ? colors.accentSoft : colors.surface, borderColor: mode === m.value ? colors.accent : colors.line }]}
          >
            <Text style={{ color: mode === m.value ? colors.accentInk : colors.inkMuted }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={heading}>INSTALL A THEME</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={handleFile} style={[box, { padding: 10, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.ink }}>Install theme…</Text>
        </Pressable>
        <Pressable onPress={() => setPasting((p) => !p)} style={{ padding: 10 }}>
          <Text style={{ color: colors.inkMuted }}>Paste JSON</Text>
        </Pressable>
      </View>

      {pasting && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <TextInput
            accessibilityLabel="Theme JSON"
            value={json}
            onChangeText={setJson}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[box, { minHeight: 140, padding: 8, color: colors.ink, fontFamily: "Courier", fontSize: 12, textAlignVertical: "top" }]}
          />
          <Pressable onPress={handlePaste} style={[box, { padding: 10, backgroundColor: colors.accentSoft, borderColor: colors.accent, alignSelf: "flex-start" }]}>
            <Text style={{ color: colors.accentInk, fontWeight: "600" }}>Install</Text>
          </Pressable>
        </View>
      )}

      {errors.length > 0 && (
        <View style={{ marginTop: 12, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: shape.radius }} accessibilityRole="alert">
          {errors.map((e) => (
            <Text key={e} style={{ color: colors.danger }}>• {e}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 8: Use shape tokens on the main vault screen**

In `apps/mobile/src/app/vault/index.tsx`, get `const { colors, shape } = useTheme();` (import from `@/theme`), then on the `+ New note` button apply `borderWidth: shape.borderWidth, borderRadius: shape.radius` and wrap it in `<HardShadow>`; apply `borderWidth`/`borderRadius` to the tag chips the same way. Keep all other styles unchanged so the Default theme renders as before (Default: 1px, 8px, no shadow).

- [ ] **Step 9: Typecheck and test**

Run: `npm run typecheck -w @simplekasten/mobile && npm test --workspaces --if-present`
Expected: clean. (If the mobile workspace has no typecheck script, run `npx tsc --noEmit -p apps/mobile`.) There is no device/emulator in this environment: state plainly in the final report that mobile was verified by typecheck only, not run.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src package-lock.json
git commit -m "Mobile: shared themes, settings modal and theme install

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document themes in the README**

Read `README.md`, then add a "Themes" section (match the surrounding heading level/style) covering: what a theme file is (link the spec), the full example JSON from the spec, how to install on desktop (Settings → Install theme… or Paste JSON) and mobile (Settings ⚙ in the header), where installed themes are stored (`<vault>/themes/<id>.json`), the reserved ids, the font keyword list, and the cross-device caveat (no sync; install on each device or copy the vault).

- [ ] **Step 2: Full verification**

Run, from the repo root, and read the output:
```bash
npm run typecheck
npm test
```
Expected: every workspace clean and all tests PASS (themes: parse/resolve/builtin/storage; desktop: themeRuntime + SettingsModal + existing; local-engine and core unchanged).

Then production-build the desktop renderer to prove `transpilePackages` works for the static export: `npm run build:renderer -w @simplekasten/desktop`. Expected: build succeeds. Delete `apps/desktop/.next` and `apps/desktop/out` afterwards if they were not present before (`git status` must show only intended files).

- [ ] **Step 3: Final Playwright pass**

Repeat the Task 7 Step 7 scenario once more against the final tree, including a screenshot of the Graph view and the note editor in Memphis (light and dark) to catch any component the theme repaints badly (e.g. unreadable text on the pink accent). Read every screenshot; fix contrast/shape problems in the built-in Memphis palette only (`packages/themes/src/builtin.ts`), re-running the themes tests. Stop the server and delete screenshots.

- [ ] **Step 4: Commit**

```bash
git add README.md packages/themes/src/builtin.ts
git commit -m "Document themes; final Memphis palette tweaks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(Omit `packages/themes/src/builtin.ts` from `git add` if step 3 changed nothing.)

- [ ] **Step 5: Hand off**

Report: what was built, test/typecheck results (with the actual numbers), what was verified in a browser vs. typecheck-only (mobile), and the two unrelated uncommitted edits still in the working tree (`NoteEditor.tsx`, `GraphView.tsx` — note GraphView also contains the Task 6 border change now, so tell the user those two files carry both their earlier fixes and, for `GraphView.tsx`, the theme change) so they can decide how to commit them.
