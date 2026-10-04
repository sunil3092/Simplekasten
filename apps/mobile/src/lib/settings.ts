import * as FileSystem from "expo-file-system/legacy";
import { DEFAULT_THEME_ID, type ModePreference } from "@simplekasten/themes";

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;
const MODES: ModePreference[] = ["system", "light", "dark"];

export interface AppearanceSettings {
  theme: string;
  themeMode: ModePreference;
}

const DEFAULTS: AppearanceSettings = { theme: DEFAULT_THEME_ID, themeMode: "system" };

async function readAll(): Promise<Record<string, unknown>> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
    if (!info.exists) return {};
    return JSON.parse(await FileSystem.readAsStringAsync(SETTINGS_PATH));
  } catch {
    return {};
  }
}

export async function loadAppearance(): Promise<AppearanceSettings> {
  const s = await readAll();
  return {
    theme: typeof s.theme === "string" ? s.theme : DEFAULTS.theme,
    themeMode: MODES.includes(s.themeMode as ModePreference) ? (s.themeMode as ModePreference) : DEFAULTS.themeMode,
  };
}

export async function saveAppearance(patch: Partial<AppearanceSettings>): Promise<void> {
  const next = { ...(await readAll()), ...patch };
  await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify(next, null, 2));
}

// Where the user dragged each Flow card. View state for this device, like
// theme and mode — not vault content — so it lives here rather than in the
// vault. Whatever can't be read as a position is dropped.
export async function loadFlowPositions(): Promise<Map<string, { x: number; y: number }>> {
  const map = new Map<string, { x: number; y: number }>();
  const raw = (await readAll()).flowPositions;
  if (raw && typeof raw === "object") {
    for (const [id, p] of Object.entries(raw as Record<string, { x?: unknown; y?: unknown }>)) {
      if (typeof p?.x === "number" && typeof p?.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y)) map.set(id, { x: p.x, y: p.y });
    }
  }
  return map;
}

export async function saveFlowPositions(positions: Map<string, { x: number; y: number }>): Promise<void> {
  const next = { ...(await readAll()), flowPositions: Object.fromEntries(positions) };
  await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify(next, null, 2));
}
