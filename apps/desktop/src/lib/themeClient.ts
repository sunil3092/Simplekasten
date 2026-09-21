import { DEFAULT_THEME_ID, type InstalledThemes, type InstallResult, type ModePreference } from "@simplekasten/themes";

export type InstallOutcome = InstallResult | { ok: false; errors: string[]; canceled: true };
export interface AppearanceSettings {
  theme: string;
  themeMode: ModePreference;
}

const DEFAULTS: AppearanceSettings = { theme: DEFAULT_THEME_ID, themeMode: "system" };

// The bridge only exists inside Electron. Guarding here keeps the renderer
// usable in a plain browser (dev/tests) with the Default theme.
function bridge(): Window["simplekasten"] | undefined {
  return typeof window === "undefined" ? undefined : window.simplekasten;
}

export const themeClient = {
  async getSettings(): Promise<AppearanceSettings> {
    return (await bridge()?.settings?.get()) ?? DEFAULTS;
  },
  async setSettings(patch: Partial<AppearanceSettings>): Promise<void> {
    await bridge()?.settings?.set(patch);
  },
  async listInstalled(): Promise<InstalledThemes> {
    return (await bridge()?.themes?.list()) ?? { themes: [], skipped: [] };
  },
  async installFromFile(): Promise<InstallOutcome> {
    return (await bridge()?.themes?.install()) ?? { ok: false, errors: ["Theme install needs the desktop app"] };
  },
  async installFromText(json: string): Promise<InstallOutcome> {
    return (await bridge()?.themes?.installFromText(json)) ?? { ok: false, errors: ["Theme install needs the desktop app"] };
  },
  async remove(id: string): Promise<void> {
    await bridge()?.themes?.remove(id);
  },
};
