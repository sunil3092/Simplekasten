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
