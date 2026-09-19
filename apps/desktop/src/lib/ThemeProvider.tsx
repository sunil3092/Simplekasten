"use client";

import {
  builtInThemes,
  defaultTheme,
  resolveModePreference,
  resolveTheme,
  type ModePreference,
  type ResolvedTheme,
  type Theme,
} from "@simplekasten/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { themeClient, type InstallOutcome } from "./themeClient";
import { applyThemeToDocument } from "./themeRuntime";

export interface ThemeContextValue {
  themes: Theme[];
  activeId: string;
  mode: ModePreference;
  resolved: ResolvedTheme;
  /** Set when the saved theme couldn't be loaded and Default was used instead. */
  notice: string | null;
  setTheme(id: string): Promise<void>;
  setMode(mode: ModePreference): Promise<void>;
  installFromFile(): Promise<InstallOutcome>;
  installFromText(json: string): Promise<InstallOutcome>;
  remove(id: string): Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [mode, setModeState] = useState<ModePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const themes = useMemo(() => [...builtInThemes, ...installed], [installed]);
  const active = themes.find((t) => t.id === activeId) ?? defaultTheme;
  const resolved = useMemo(
    () => resolveTheme(active, resolveModePreference(mode, systemDark)),
    [active, mode, systemDark],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settings, list] = await Promise.all([themeClient.getSettings(), themeClient.listInstalled()]);
      if (cancelled) return;
      setInstalled(list.themes);
      setModeState(settings.themeMode);
      setActiveId(settings.theme);
      const known = [...builtInThemes, ...list.themes].some((t) => t.id === settings.theme);
      if (!known) setNotice(`Theme "${settings.theme}" could not be loaded, so Default is being used.`);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  const setTheme = useCallback(async (id: string) => {
    setActiveId(id);
    setNotice(null);
    await themeClient.setSettings({ theme: id });
  }, []);

  const setMode = useCallback(async (next: ModePreference) => {
    setModeState(next);
    await themeClient.setSettings({ themeMode: next });
  }, []);

  const refreshInstalled = useCallback(async () => {
    setInstalled((await themeClient.listInstalled()).themes);
  }, []);

  const installFromFile = useCallback(async () => {
    const outcome = await themeClient.installFromFile();
    if (outcome.ok) await refreshInstalled();
    return outcome;
  }, [refreshInstalled]);

  const installFromText = useCallback(
    async (json: string) => {
      const outcome = await themeClient.installFromText(json);
      if (outcome.ok) await refreshInstalled();
      return outcome;
    },
    [refreshInstalled],
  );

  const remove = useCallback(
    async (id: string) => {
      await themeClient.remove(id);
      await refreshInstalled();
      // Removing the active theme falls back to Default (and persists that).
      if (id === activeId) await setTheme("default");
    },
    [activeId, refreshInstalled, setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ themes, activeId, mode, resolved, notice, setTheme, setMode, installFromFile, installFromText, remove }),
    [themes, activeId, mode, resolved, notice, setTheme, setMode, installFromFile, installFromText, remove],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
