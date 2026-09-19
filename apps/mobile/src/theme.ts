import { useTheme } from "@/components/ThemeProvider";

// Colours now come from the active shared theme (packages/themes) instead of
// two hand-copied palettes — same keys as before, plus bg/lineSoft/danger/
// dangerSoft.
export function useThemeColors() {
  return useTheme().colors;
}

export { useTheme };
