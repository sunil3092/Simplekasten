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
  // Tailwind inlines its shadow-* values instead of reading --shadow-*, so the
  // themed shadow is applied by attribute-scoped rules in globals.css.
  root.toggleAttribute("data-hard-shadow", theme.shape.shadow !== null);
}
