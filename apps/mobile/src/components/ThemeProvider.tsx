import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  builtInThemes,
  DEFAULT_THEME_ID,
  defaultTheme,
  resolveModePreference,
  resolveTheme,
  type InstallResult,
  type ModePreference,
  type ResolvedTheme,
  type Theme,
} from "@simplekasten/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { loadAppearance, saveAppearance } from "@/lib/settings";
import { vault } from "@/lib/vault";

const MAX_THEME_FILE_BYTES = 256 * 1024;

export type InstallOutcome = InstallResult | { ok: false; errors: string[]; canceled: true };

interface ThemeContextValue {
  colors: ResolvedTheme["colors"];
  shape: ResolvedTheme["shape"];
  font: ResolvedTheme["font"];
  resolved: ResolvedTheme;
  themes: Theme[];
  activeId: string;
  mode: ModePreference;
  /** Set when the saved theme couldn't be loaded and Default was used instead. */
  notice: string | null;
  setTheme(id: string): Promise<void>;
  setMode(mode: ModePreference): Promise<void>;
  install(json: string): Promise<InstallResult>;
  installFromFile(): Promise<InstallOutcome>;
  remove(id: string): Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useColorScheme() === "dark";
  const [installed, setInstalled] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState(DEFAULT_THEME_ID);
  const [mode, setModeState] = useState<ModePreference>("system");
  const [notice, setNotice] = useState<string | null>(null);

  const themes = useMemo(() => [...builtInThemes, ...installed], [installed]);
  const active = themes.find((t) => t.id === activeId) ?? defaultTheme;
  const resolved = useMemo(
    () => resolveTheme(active, resolveModePreference(mode, systemDark)),
    [active, mode, systemDark],
  );

  useEffect(() => {
    (async () => {
      const [settings, list] = await Promise.all([loadAppearance(), vault.listThemes()]);
      setInstalled(list.themes);
      setModeState(settings.themeMode);
      setActiveId(settings.theme);
      const known = [...builtInThemes, ...list.themes].some((t) => t.id === settings.theme);
      if (!known) setNotice(`Theme "${settings.theme}" could not be loaded, so ${defaultTheme.name} is being used.`);
    })().catch(() => {});
  }, []);

  const refreshInstalled = useCallback(async () => setInstalled((await vault.listThemes()).themes), []);

  const setTheme = useCallback(async (id: string) => {
    setActiveId(id);
    setNotice(null);
    await saveAppearance({ theme: id });
  }, []);

  const setMode = useCallback(async (next: ModePreference) => {
    setModeState(next);
    await saveAppearance({ themeMode: next });
  }, []);

  const install = useCallback(
    async (json: string) => {
      const result = await vault.installTheme(json);
      if (result.ok) await refreshInstalled();
      return result;
    },
    [refreshInstalled],
  );

  const installFromFile = useCallback(async (): Promise<InstallOutcome> => {
    const picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (picked.canceled || picked.assets.length === 0) return { ok: false, errors: [], canceled: true };

    const asset = picked.assets[0];
    if ((asset.size ?? 0) > MAX_THEME_FILE_BYTES) {
      return { ok: false, errors: ["File is too large to be a theme (max 256 KB)"] };
    }
    return install(await FileSystem.readAsStringAsync(asset.uri));
  }, [install]);

  const remove = useCallback(
    async (id: string) => {
      await vault.removeTheme(id);
      await refreshInstalled();
      // Removing the active theme falls back to the default theme (and persists that).
      if (id === activeId) await setTheme(DEFAULT_THEME_ID);
    },
    [activeId, refreshInstalled, setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolved.colors,
      shape: resolved.shape,
      font: resolved.font,
      resolved,
      themes,
      activeId,
      mode,
      notice,
      setTheme,
      setMode,
      install,
      installFromFile,
      remove,
    }),
    [resolved, themes, activeId, mode, notice, setTheme, setMode, install, installFromFile, remove],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
