import { useColorScheme } from "react-native";

// Mirrors apps/desktop/src/app/globals.css's palette so the native app reads as
// the same product, not a reskin.
export const lightColors = {
  surface: "#ffffff",
  surface2: "#f1f5f9",
  ink: "#0f172a",
  inkMuted: "#475569",
  inkFaint: "#94a3b8",
  line: "#e2e8f0",
  accent: "#059669",
  accentInk: "#065f46",
  accentSoft: "#ecfdf5",
  accent2: "#b45309",
  accent2Soft: "#fffbeb",
};

export const darkColors = {
  surface: "#111827",
  surface2: "#1e293b",
  ink: "#f1f5f9",
  inkMuted: "#94a3b8",
  inkFaint: "#64748b",
  line: "#2b3646",
  accent: "#34d399",
  accentInk: "#a7f3d0",
  accentSoft: "#0f2b22",
  accent2: "#fbbf24",
  accent2Soft: "#3a2c0d",
};

export type ThemeColors = typeof lightColors;

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
