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
