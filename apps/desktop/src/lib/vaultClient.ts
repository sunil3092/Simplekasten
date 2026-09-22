// Talks to the Electron main process via the preload bridge (see
// apps/desktop/preload.js) — every note/tag/graph/search operation is a
// local filesystem call, never a network request. No auth: there's nothing
// to log into, this window only ever has one local vault open.
import type { InstalledThemes, InstallResult, ModePreference } from "@simplekasten/themes";

declare global {
  interface Window {
    simplekasten: {
      settings: {
        get: () => Promise<{ theme: string; themeMode: ModePreference }>;
        set: (patch: Partial<{ theme: string; themeMode: ModePreference }>) => Promise<void>;
      };
      themes: {
        list: () => Promise<InstalledThemes>;
        install: () => Promise<InstallResult | { ok: false; errors: string[]; canceled: true }>;
        installFromText: (json: string) => Promise<InstallResult>;
        remove: (id: string) => Promise<void>;
      };
      vault: {
        listNotes: (tag?: string) => Promise<unknown>;
        getNoteById: (id: string) => Promise<unknown>;
        createNote: (input: unknown) => Promise<unknown>;
        updateNote: (input: unknown) => Promise<unknown>;
        deleteNote: (id: string) => Promise<unknown>;
        search: (query: string) => Promise<unknown>;
        getGraph: () => Promise<unknown>;
        listTags: () => Promise<unknown>;
        getOrCreateDailyNote: (date: string) => Promise<unknown>;
        listDailyNotes: (limit?: number) => Promise<unknown>;
        getVaultPath: () => Promise<string>;
        chooseVaultFolder: () => Promise<string>;
        addAttachment: (noteId: string) => Promise<unknown>;
        deleteAttachment: (id: string) => Promise<void>;
        attachmentUrl: (id: string) => string;
      };
    };
  }
}

function vault() {
  return window.simplekasten.vault;
}

export const vaultClient = {
  listNotes: (tag?: string) => vault().listNotes(tag),
  getNoteById: (id: string) => vault().getNoteById(id),
  createNote: (input: { title: string; content: string; type?: string }) => vault().createNote(input),
  updateNote: (input: { id: string; title?: string; content?: string; type?: string }) => vault().updateNote(input),
  deleteNote: (id: string) => vault().deleteNote(id),
  search: (query: string) => vault().search(query),
  getGraph: () => vault().getGraph(),
  listTags: () => vault().listTags(),
  getOrCreateDailyNote: (date: string) => vault().getOrCreateDailyNote(date),
  listDailyNotes: (limit?: number) => vault().listDailyNotes(limit),
  getVaultPath: () => vault().getVaultPath(),
  chooseVaultFolder: () => vault().chooseVaultFolder(),
  addAttachment: (noteId: string) => vault().addAttachment(noteId),
  deleteAttachment: (id: string) => vault().deleteAttachment(id),
  attachmentUrl: (id: string) => vault().attachmentUrl(id),
};

/** The vault folder on disk already *is* the portable export — nothing to zip. */
export async function showVaultLocation(): Promise<void> {
  const path = await vaultClient.getVaultPath();
  window.alert(`Your notes are plain files on disk:\n${path}`);
}
