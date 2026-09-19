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
