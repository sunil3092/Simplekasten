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
