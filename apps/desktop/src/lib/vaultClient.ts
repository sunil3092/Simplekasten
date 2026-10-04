// Talks to the Electron main process via the preload bridge (see
// apps/desktop/preload.js) — every note/tag/graph/search operation is a
// local filesystem call, never a network request. No auth: there's nothing
// to log into, this window only ever has one local vault open.
import type {
  Attachment,
  CanvasData,
  CanvasListItem,
  CreateCanvasInput,
  CreateNoteInput,
  CreateTemplateInput,
  GraphData,
  HistorySnapshot,
  NoteDetail,
  NoteListItem,
  NoteVersion,
  PurgeResult,
  SearchResultItem,
  SubmitReviewInput,
  TagItem,
  Template,
  UpdateCanvasInput,
  UpdateNoteInput,
  UpdateTemplateInput,
  VaultNote,
} from "@simplekasten/local-engine";
import type { InstalledThemes, InstallResult, ModePreference } from "@simplekasten/themes";

/**
 * The vault half of the preload bridge, stated once here.
 *
 * Every method's return type is the engine function's own: main.js forwards
 * straight to `packages/local-engine` (see its `ipcMain.handle` calls), so
 * what arrives in the renderer is exactly what the engine returned. Typing
 * that here rather than as `unknown` is what keeps callers from having to
 * assert a type on every single call.
 */
export interface VaultBridge {
  listNotes: (tag?: string) => Promise<NoteListItem[]>;
  /** `null` when no live note has that id. */
  getNoteById: (id: string) => Promise<NoteDetail | null>;
  createNote: (input: CreateNoteInput) => Promise<VaultNote>;
  updateNote: (input: UpdateNoteInput) => Promise<VaultNote>;
  deleteNote: (id: string) => Promise<void>;
  search: (query: string) => Promise<SearchResultItem[]>;
  getGraph: () => Promise<GraphData>;
  listTags: () => Promise<TagItem[]>;
  getOrCreateDailyNote: (date: string) => Promise<VaultNote>;
  listDailyNotes: (limit?: number) => Promise<NoteListItem[]>;
  listTemplates: () => Promise<Template[]>;
  createTemplate: (input: CreateTemplateInput) => Promise<Template>;
  updateTemplate: (input: UpdateTemplateInput) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;
  setDefaultForDailyNote: (id: string) => Promise<Template>;
  applyTemplate: (input: { noteId: string; templateId: string }) => Promise<NoteDetail>;
  addToReviewQueue: (noteId: string, today: string) => Promise<VaultNote>;
  removeFromReviewQueue: (noteId: string) => Promise<VaultNote>;
  listDueForReview: (date: string) => Promise<NoteListItem[]>;
  submitReview: (input: SubmitReviewInput) => Promise<VaultNote>;
  listNoteVersions: (noteId: string) => Promise<NoteVersion[]>;
  getNoteVersion: (noteId: string, versionId: string) => Promise<HistorySnapshot>;
  restoreNoteVersion: (noteId: string, versionId: string) => Promise<VaultNote>;
  listCanvases: () => Promise<CanvasListItem[]>;
  createCanvas: (input: CreateCanvasInput) => Promise<CanvasData>;
  getCanvas: (id: string) => Promise<CanvasData>;
  updateCanvas: (input: UpdateCanvasInput) => Promise<CanvasData>;
  deleteCanvas: (id: string) => Promise<void>;
  getVaultPath: () => Promise<string>;
  /** The chosen folder, or the current one if the dialog was cancelled. */
  chooseVaultFolder: () => Promise<string>;
  purgeVault: () => Promise<PurgeResult>;
  /** `null` when the file dialog was cancelled. */
  addAttachment: (noteId: string) => Promise<Attachment | null>;
  deleteAttachment: (id: string) => Promise<void>;
  attachmentUrl: (id: string) => string;
}

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
      vault: VaultBridge;
    };
  }
}

// Read per call, not captured at module load: window.simplekasten only
// exists inside Electron, and this module is imported by the renderer long
// before any of it is called.
function vault(): VaultBridge {
  return window.simplekasten.vault;
}

// Annotating this as VaultBridge is what types each forwarder's parameters
// and result, so no signature is written out twice.
export const vaultClient: VaultBridge = {
  listNotes: (tag) => vault().listNotes(tag),
  getNoteById: (id) => vault().getNoteById(id),
  createNote: (input) => vault().createNote(input),
  updateNote: (input) => vault().updateNote(input),
  deleteNote: (id) => vault().deleteNote(id),
  search: (query) => vault().search(query),
  getGraph: () => vault().getGraph(),
  listTags: () => vault().listTags(),
  getOrCreateDailyNote: (date) => vault().getOrCreateDailyNote(date),
  listDailyNotes: (limit) => vault().listDailyNotes(limit),
  listTemplates: () => vault().listTemplates(),
  createTemplate: (input) => vault().createTemplate(input),
  updateTemplate: (input) => vault().updateTemplate(input),
  deleteTemplate: (id) => vault().deleteTemplate(id),
  setDefaultForDailyNote: (id) => vault().setDefaultForDailyNote(id),
  applyTemplate: (input) => vault().applyTemplate(input),
  addToReviewQueue: (noteId, today) => vault().addToReviewQueue(noteId, today),
  removeFromReviewQueue: (noteId) => vault().removeFromReviewQueue(noteId),
  listDueForReview: (date) => vault().listDueForReview(date),
  submitReview: (input) => vault().submitReview(input),
  listNoteVersions: (noteId) => vault().listNoteVersions(noteId),
  getNoteVersion: (noteId, versionId) => vault().getNoteVersion(noteId, versionId),
  restoreNoteVersion: (noteId, versionId) => vault().restoreNoteVersion(noteId, versionId),
  listCanvases: () => vault().listCanvases(),
  createCanvas: (input) => vault().createCanvas(input),
  getCanvas: (id) => vault().getCanvas(id),
  updateCanvas: (input) => vault().updateCanvas(input),
  deleteCanvas: (id) => vault().deleteCanvas(id),
  getVaultPath: () => vault().getVaultPath(),
  chooseVaultFolder: () => vault().chooseVaultFolder(),
  purgeVault: () => vault().purgeVault(),
  addAttachment: (noteId) => vault().addAttachment(noteId),
  deleteAttachment: (id) => vault().deleteAttachment(id),
  attachmentUrl: (id) => vault().attachmentUrl(id),
};

/**
 * A note the caller just created, edited or picked from a list it already
 * holds — so `getNoteById`'s `null` (no live note with that id) means
 * something has gone wrong rather than being an ordinary outcome to render.
 */
export async function loadNote(id: string): Promise<NoteDetail> {
  const detail = await vaultClient.getNoteById(id);
  if (!detail) throw new Error(`Note "${id}" could not be loaded`);
  return detail;
}

/** The vault folder on disk already *is* the portable export — nothing to zip. */
export async function showVaultLocation(): Promise<void> {
  const path = await vaultClient.getVaultPath();
  window.alert(`Your notes are plain files on disk:\n${path}`);
}
