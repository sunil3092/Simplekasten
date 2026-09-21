import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR_KEYS, defaultTheme, type ColorKey } from "@simplekasten/themes";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const [lightCss, darkCss] = css.split("@media (prefers-color-scheme: dark)");

const TOKEN: Record<ColorKey, string> = {
  bg: "bg", surface: "surface", surface2: "surface-2", ink: "ink", inkMuted: "ink-muted", inkFaint: "ink-faint",
  line: "line", lineSoft: "line-soft", accent: "accent", accentInk: "accent-ink", accentSoft: "accent-soft",
  accent2: "accent-2", accent2Soft: "accent-2-soft", danger: "danger", dangerSoft: "danger-soft",
};

function tokenValue(block: string, key: ColorKey): string | undefined {
  return block.match(new RegExp(`--color-${TOKEN[key]}:\\s*(#[0-9a-fA-F]+);`))?.[1];
}

describe("globals.css first-paint tokens", () => {
  it("match the default theme's light palette", () => {
    for (const key of COLOR_KEYS) expect(tokenValue(lightCss, key), key).toBe(defaultTheme.colors.light[key]);
  });

  it("match the default theme's dark palette", () => {
    for (const key of COLOR_KEYS) expect(tokenValue(darkCss, key), key).toBe(defaultTheme.colors.dark![key]);
  });

  it("match the default theme's shape", () => {
    const { borderWidth, shadow } = defaultTheme.shape;
    expect(css).toContain(`--border-w: ${borderWidth}px;`);
    expect(css).toContain(`--shadow-md: ${shadow!.x}px ${shadow!.y}px 0 ${shadow!.color};`);
  });
});
