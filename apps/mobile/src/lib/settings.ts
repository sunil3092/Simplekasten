import * as FileSystem from "expo-file-system/legacy";
import type { ModePreference } from "@simplekasten/themes";

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;
const MODES: ModePreference[] = ["system", "light", "dark"];

export interface AppearanceSettings {
  theme: string;
  themeMode: ModePreference;
}

const DEFAULTS: AppearanceSettings = { theme: "default", themeMode: "system" };

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
