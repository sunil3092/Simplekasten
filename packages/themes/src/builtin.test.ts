import { describe, expect, it } from "vitest";
import { builtInThemes, classicTheme, DEFAULT_THEME_ID, defaultTheme, memphisTheme } from "./builtin";
import { RESERVED_THEME_IDS, themeSchema } from "./schema";
import { resolveTheme } from "./resolve";

describe("built-in themes", () => {
  it("are all valid against the schema", () => {
    for (const theme of builtInThemes) expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("use exactly the reserved ids", () => {
    expect(builtInThemes.map((t) => t.id).sort()).toEqual([...RESERVED_THEME_IDS].sort());
  });

  it("memphis is the default theme", () => {
    expect(defaultTheme).toBe(memphisTheme);
    expect(DEFAULT_THEME_ID).toBe("memphis");
    expect(builtInThemes[0]).toBe(memphisTheme);
  });

  it("classic keeps the original slate palette", () => {
    expect(resolveTheme(classicTheme, "light").colors).toMatchObject({
      bg: "#f8fafc", surface: "#ffffff", ink: "#0f172a", accent: "#059669", accent2: "#b45309", danger: "#dc2626",
    });
    expect(resolveTheme(classicTheme, "dark").colors).toMatchObject({
      bg: "#0b1120", surface: "#111827", ink: "#f1f5f9", accent: "#34d399", accent2: "#fbbf24", danger: "#f87171",
    });
  });

  it("classic keeps the original shape (1px borders, 8px radius, no shadow)", () => {
    expect(classicTheme.shape).toEqual({ borderWidth: 1, radius: 8 });
  });

  it("memphis is chunky: thick borders, square corners, hard shadow, distinct dark palette", () => {
    expect(memphisTheme.shape.borderWidth).toBe(3);
    expect(memphisTheme.shape.radius).toBe(0);
    expect(memphisTheme.shape.shadow).toEqual({ x: 4, y: 4, color: "#0cb2c0" });
    expect(memphisTheme.colors.dark).toBeDefined();
    expect(memphisTheme.colors.dark!.bg).not.toBe(memphisTheme.colors.light.bg);
  });

  it("memphis uses the purple/pink/yellow/teal/cream palette in both modes", () => {
    expect(resolveTheme(memphisTheme, "light").colors).toMatchObject({ bg: "#e8e6d9", accent: "#f725a0" });
    expect(resolveTheme(memphisTheme, "dark").colors).toMatchObject({
      bg: "#1d0a2e", ink: "#e8e6d9", line: "#fad141", accent: "#f725a0", accent2: "#0cb2c0",
    });
  });
});
