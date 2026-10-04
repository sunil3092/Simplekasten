import type { Theme } from "./schema";

/** The original slate-and-emerald look: thin borders, rounded corners, no shadow. */
export const classicTheme: Theme = {
  schemaVersion: 1,
  id: "classic",
  name: "Classic",
  colors: {
    light: {
      bg: "#f8fafc",
      surface: "#ffffff",
      surface2: "#f1f5f9",
      ink: "#0f172a",
      inkMuted: "#475569",
      inkFaint: "#94a3b8",
      line: "#e2e8f0",
      lineSoft: "#edf1f5",
      accent: "#059669",
      accentInk: "#065f46",
      accentSoft: "#ecfdf5",
      accent2: "#b45309",
      accent2Soft: "#fffbeb",
      danger: "#dc2626",
      dangerSoft: "#fef2f2",
    },
    dark: {
      bg: "#0b1120",
      surface: "#111827",
      surface2: "#1e293b",
      ink: "#f1f5f9",
      inkMuted: "#94a3b8",
      inkFaint: "#64748b",
      line: "#2b3646",
      lineSoft: "#1c2534",
      accent: "#34d399",
      accentInk: "#a7f3d0",
      accentSoft: "#0f2b22",
      accent2: "#fbbf24",
      accent2Soft: "#3a2c0d",
      danger: "#f87171",
      dangerSoft: "#3a1414",
    },
  },
  shape: { borderWidth: 1, radius: 8 },
  font: { display: "sans", body: "sans", mono: "mono" },
};

/**
 * Memphis, built on a five-colour palette — purple #672394, pink #f725a0,
 * yellow #fad141, teal #0cb2c0, cream #e8e6d9. Light: cream ground with
 * purple-black ink and borders. Dark: deep-purple ground with cream ink and
 * yellow borders. Pink is the accent and teal the second accent and the
 * blur-free offset shadow in both modes; heavy borders, square corners.
 */
export const memphisTheme: Theme = {
  schemaVersion: 1,
  id: "memphis",
  name: "Memphis",
  colors: {
    light: {
      bg: "#e8e6d9",
      surface: "#faf8f0",
      surface2: "#fbe28a",
      ink: "#1f0f2e",
      inkMuted: "#4a3560",
      inkFaint: "#6b5a7d",
      line: "#1f0f2e",
      lineSoft: "#cfc9b6",
      accent: "#f725a0",
      accentInk: "#672394",
      accentSoft: "#fdc9e6",
      accent2: "#08707c",
      accent2Soft: "#bfeaf0",
      danger: "#c81e3a",
      dangerSoft: "#fcd5da",
    },
    dark: {
      bg: "#1d0a2e",
      surface: "#2a1044",
      surface2: "#3c1a5e",
      ink: "#e8e6d9",
      inkMuted: "#c4bccf",
      inkFaint: "#9a8bb0",
      line: "#fad141",
      lineSoft: "#4a2a72",
      accent: "#f725a0",
      accentInk: "#ff9ad0",
      accentSoft: "#4a1547",
      accent2: "#0cb2c0",
      accent2Soft: "#0b3d4a",
      danger: "#ff6b7d",
      dangerSoft: "#4a1a2a",
    },
  },
  shape: {
    borderWidth: 3,
    radius: 0,
    shadow: { x: 4, y: 4, color: "#0cb2c0" },
  },
  font: { display: "rounded-bold", body: "sans", mono: "mono" },
};

/** SnowUI-inspired professional surfaces using the supplied green, blue, red, sage and cream palette. */
export const snowUiTheme: Theme = {
  schemaVersion: 1,
  id: "snowui",
  name: "SnowUI",
  colors: {
    light: {
      bg: "#f4eed7",
      surface: "#fffdf6",
      surface2: "#e6ece8",
      ink: "#25312b",
      inkMuted: "#4c5b52",
      inkFaint: "#626f67",
      line: "#c7d4cc",
      lineSoft: "#e1e7e2",
      accent: "#23764a",
      accentInk: "#173d29",
      accentSoft: "#e1f2e7",
      accent2: "#246f83",
      accent2Soft: "#e1eef1",
      danger: "#ca2525",
      dangerSoft: "#fff4f0",
    },
    dark: {
      bg: "#171e1a",
      surface: "#202a24",
      surface2: "#2b3931",
      ink: "#f4eed7",
      inkMuted: "#c7d4cc",
      inkFaint: "#a1b1a8",
      line: "#42534a",
      lineSoft: "#303b35",
      accent: "#23764a",
      accentInk: "#d9f2e2",
      accentSoft: "#244533",
      accent2: "#59b5cb",
      accent2Soft: "#203e47",
      danger: "#ff7772",
      dangerSoft: "#4b2828",
    },
  },
  shape: { borderWidth: 1, radius: 8 },
  font: { display: "sans", body: "sans", mono: "mono" },
};

/** Used when nothing is saved, or the saved theme can no longer be loaded. */
export const defaultTheme: Theme = classicTheme;
export const DEFAULT_THEME_ID = defaultTheme.id;

export const builtInThemes: Theme[] = [classicTheme, memphisTheme, snowUiTheme];
