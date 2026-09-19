import type { FileSystemAdapter } from "@simplekasten/local-engine";
import { parseTheme } from "./parse";
import { RESERVED_THEME_IDS, type Theme } from "./schema";

const THEMES_DIR = "themes";

export interface InstalledThemes {
  themes: Theme[];
  skipped: { file: string; errors: string[] }[];
}

export type InstallResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

const themePath = (id: string) => `${THEMES_DIR}/${id}.json`;

export async function listInstalledThemes(fs: FileSystemAdapter): Promise<InstalledThemes> {
  const files = (await fs.listFiles(THEMES_DIR)).filter((f) => f.endsWith(".json")).sort();
  const themes: Theme[] = [];
  const skipped: InstalledThemes["skipped"] = [];

  for (const file of files) {
    try {
      const parsed = parseTheme(await fs.readFile(`${THEMES_DIR}/${file}`));
      if (parsed.ok) themes.push(parsed.theme);
      else skipped.push({ file, errors: parsed.errors });
    } catch (err) {
      skipped.push({ file, errors: [err instanceof Error ? err.message : "Could not read file"] });
    }
  }
  return { themes, skipped };
}

export async function installTheme(fs: FileSystemAdapter, json: string): Promise<InstallResult> {
  const parsed = parseTheme(json);
  if (!parsed.ok) return parsed;
  if (RESERVED_THEME_IDS.includes(parsed.theme.id)) {
    return { ok: false, errors: [`id: "${parsed.theme.id}" is a built-in theme id — pick a different id`] };
  }
  await fs.ensureDir(THEMES_DIR);
  await fs.writeFile(themePath(parsed.theme.id), JSON.stringify(parsed.theme, null, 2));
  return { ok: true, theme: parsed.theme };
}

export async function removeTheme(fs: FileSystemAdapter, id: string): Promise<void> {
  // id is validated against ^[a-z0-9-]{1,40}$ before it is ever used in a path.
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return;
  await fs.deleteFile(themePath(id));
}
