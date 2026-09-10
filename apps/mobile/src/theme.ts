import { useColorScheme } from "react-native";

// Mirrors apps/web/src/app/globals.css's palette so the native app reads as
// the same product, not a reskin.
export const lightColors = {
  surface: "#fbfbf6",
  surface2: "#f2f3eb",
  ink: "#1e2a20",
  inkMuted: "#57614f",
  inkFaint: "#8b9481",
  line: "#c8ccb8",
  accent: "#2e6f5a",
  accentInk: "#1d4a3c",
  accentSoft: "#dce8dd",
  accent2: "#93602a",
  accent2Soft: "#ede0cb",
};

export const darkColors = {
  surface: "#1b2117",
  surface2: "#20271b",
  ink: "#e8eadc",
  inkMuted: "#a7af98",
  inkFaint: "#6e7763",
  line: "#333b2a",
  accent: "#6fbf9e",
  accentInk: "#bfe9d7",
  accentSoft: "#22332a",
  accent2: "#cb9c55",
  accent2Soft: "#332a18",
};

export type ThemeColors = typeof lightColors;

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
