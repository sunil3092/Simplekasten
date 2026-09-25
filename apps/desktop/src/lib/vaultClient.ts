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
        listTemplates: () => Promise<unknown>;
        createTemplate: (input: { name: string; content: string }) => Promise<unknown>;
        updateTemplate: (input: { id: string; name?: string; content?: string }) => Promise<unknown>;
        deleteTemplate: (id: string) => Promise<void>;
        setDefaultForDailyNote: (id: string) => Promise<unknown>;
        applyTemplate: (input: { noteId: string; templateId: string }) => Promise<unknown>;
        addToReviewQueue: (noteId: string, today: string) => Promise<unknown>;
        removeFromReviewQueue: (noteId: string) => Promise<unknown>;
        listDueForReview: (date: string) => Promise<unknown>;
        submitReview: (input: { noteId: string; rating: "again" | "hard" | "good" | "easy"; today: string }) => Promise<unknown>;
        listNoteVersions: (noteId: string) => Promise<unknown>;
        getNoteVersion: (noteId: string, versionId: string) => Promise<unknown>;
        restoreNoteVersion: (noteId: string, versionId: string) => Promise<unknown>;
        listCanvases: () => Promise<unknown>;
        createCanvas: (input: { title: string }) => Promise<unknown>;
        getCanvas: (id: string) => Promise<unknown>;
        updateCanvas: (input: { id: string; title?: string; cards?: unknown[] }) => Promise<unknown>;
        deleteCanvas: (id: string) => Promise<void>;
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
  listTemplates: () => vault().listTemplates(),
  createTemplate: (input: { name: string; content: string }) => vault().createTemplate(input),
  updateTemplate: (input: { id: string; name?: string; content?: string }) => vault().updateTemplate(input),
  deleteTemplate: (id: string) => vault().deleteTemplate(id),
  setDefaultForDailyNote: (id: string) => vault().setDefaultForDailyNote(id),
  applyTemplate: (input: { noteId: string; templateId: string }) => vault().applyTemplate(input),
  addToReviewQueue: (noteId: string, today: string) => vault().addToReviewQueue(noteId, today),
  removeFromReviewQueue: (noteId: string) => vault().removeFromReviewQueue(noteId),
  listDueForReview: (date: string) => vault().listDueForReview(date),
  submitReview: (input: { noteId: string; rating: "again" | "hard" | "good" | "easy"; today: string }) => vault().submitReview(input),
  listNoteVersions: (noteId: string) => vault().listNoteVersions(noteId),
  getNoteVersion: (noteId: string, versionId: string) => vault().getNoteVersion(noteId, versionId),
  restoreNoteVersion: (noteId: string, versionId: string) => vault().restoreNoteVersion(noteId, versionId),
  listCanvases: () => vault().listCanvases(),
  createCanvas: (input: { title: string }) => vault().createCanvas(input),
  getCanvas: (id: string) => vault().getCanvas(id),
  updateCanvas: (input: { id: string; title?: string; cards?: unknown[] }) => vault().updateCanvas(input),
  deleteCanvas: (id: string) => vault().deleteCanvas(id),
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
