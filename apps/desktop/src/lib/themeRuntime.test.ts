import { describe, expect, it } from "vitest";
import { classicTheme, memphisTheme, resolveTheme } from "@simplekasten/themes";
import { applyThemeToDocument, themeToCssVars } from "./themeRuntime";

describe("themeToCssVars", () => {
  it("maps colour keys to the Tailwind --color-* variable names", () => {
    const vars = themeToCssVars(resolveTheme(classicTheme, "light"));
    expect(vars["--color-bg"]).toBe("#f8fafc");
    expect(vars["--color-surface-2"]).toBe("#f1f5f9");
    expect(vars["--color-accent-2-soft"]).toBe("#fffbeb");
    expect(vars["--color-line-soft"]).toBe("#edf1f5");
  });

  it("derives a radius scale that reproduces Tailwind's defaults at radius 8", () => {
    const vars = themeToCssVars(resolveTheme(classicTheme, "light"));
    expect(vars["--radius-sm"]).toBe("4px");
    expect(vars["--radius-md"]).toBe("6px");
    expect(vars["--radius-lg"]).toBe("8px");
    expect(vars["--radius-xl"]).toBe("12px");
    expect(vars["--radius-2xl"]).toBe("16px");
  });

  it("removes shadow overrides when the theme has no shadow (Tailwind defaults apply)", () => {
    const vars = themeToCssVars(resolveTheme(classicTheme, "light"));
    expect(vars["--shadow-sm"]).toBeNull();
    expect(vars["--shadow-2xl"]).toBeNull();
  });

  it("emits hard, blur-free offset shadows for a themed shadow", () => {
    const vars = themeToCssVars(resolveTheme(memphisTheme, "light"));
    expect(vars["--shadow-md"]).toBe("4px 4px 0 #0cb2c0");
    expect(vars["--shadow-sm"]).toBe("2px 2px 0 #0cb2c0");
    expect(vars["--shadow-lg"]).toBe("6px 6px 0 #0cb2c0");
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
    applyThemeToDocument(resolveTheme(classicTheme, "dark"), root);
    expect(root.style.getPropertyValue("--color-bg")).toBe("#0b1120");
    expect(root.style.getPropertyValue("--shadow-md")).toBe("");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("flags data-hard-shadow only while the active theme defines a shadow", () => {
    const root = document.createElement("html");
    applyThemeToDocument(resolveTheme(memphisTheme, "light"), root);
    expect(root.hasAttribute("data-hard-shadow")).toBe(true);
    applyThemeToDocument(resolveTheme(classicTheme, "light"), root);
    expect(root.hasAttribute("data-hard-shadow")).toBe(false);
  });
});
