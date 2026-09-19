import type { Theme } from "./schema";

/** Exactly today's look — values copied from apps/desktop/src/app/globals.css. */
export const defaultTheme: Theme = {
  schemaVersion: 1,
  id: "default",
  name: "Default",
  colors: {
    light: {
      bg: "#f8fafc", surface: "#ffffff", surface2: "#f1f5f9", ink: "#0f172a", inkMuted: "#475569",
      inkFaint: "#94a3b8", line: "#e2e8f0", lineSoft: "#edf1f5", accent: "#059669", accentInk: "#065f46",
      accentSoft: "#ecfdf5", accent2: "#b45309", accent2Soft: "#fffbeb", danger: "#dc2626", dangerSoft: "#fef2f2",
    },
    dark: {
      bg: "#0b1120", surface: "#111827", surface2: "#1e293b", ink: "#f1f5f9", inkMuted: "#94a3b8",
      inkFaint: "#64748b", line: "#2b3646", lineSoft: "#1c2534", accent: "#34d399", accentInk: "#a7f3d0",
      accentSoft: "#0f2b22", accent2: "#fbbf24", accent2Soft: "#3a2c0d", danger: "#f87171", dangerSoft: "#3a1414",
    },
  },
  shape: { borderWidth: 1, radius: 8 },
  font: { display: "sans", body: "sans", mono: "mono" },
};

/**
 * Memphis: cream/butter ground, hot pink + teal + yellow accents, heavy black
 * borders, square corners and a blur-free pink offset shadow.
 */
export const memphisTheme: Theme = {
  schemaVersion: 1,
  id: "memphis",
  name: "Memphis",
  colors: {
    light: {
      bg: "#fff4d6", surface: "#ffffff", surface2: "#ffe8a3", ink: "#111111", inkMuted: "#3b3b3b",
      inkFaint: "#6b6b6b", line: "#111111", lineSoft: "#e6d9b0", accent: "#e6007e", accentInk: "#a3005a",
      accentSoft: "#ffd6ec", accent2: "#007f73", accent2Soft: "#c9f5ef", danger: "#d62828", dangerSoft: "#ffdada",
    },
    dark: {
      bg: "#14163a", surface: "#1e2159", surface2: "#2a2e7a", ink: "#fff4d6", inkMuted: "#c9c3e6",
      inkFaint: "#9a95c7", line: "#f3e9c6", lineSoft: "#3a3f94", accent: "#e6007e", accentInk: "#ffb3dd",
      accentSoft: "#4a1a45", accent2: "#2ee6d0", accent2Soft: "#0e3f45", danger: "#ff6b6b", dangerSoft: "#4a1a1f",
    },
  },
  shape: { borderWidth: 3, radius: 0, shadow: { x: 4, y: 4, color: "#ff3ea5" } },
  font: { display: "rounded-bold", body: "sans", mono: "mono" },
};

export const builtInThemes: Theme[] = [defaultTheme, memphisTheme];
