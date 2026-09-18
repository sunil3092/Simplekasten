// See packages/local-engine/src/adapters/expo.ts for why this is /legacy,
// not the bare "expo-file-system" entry.
import * as FileSystem from "expo-file-system/legacy";
import { createExpoFsAdapter } from "@simplekasten/local-engine/adapters/expo";
import * as engine from "@simplekasten/local-engine";

// One fixed vault directory — no folder picker on mobile (see the shared
// vault library spec's "Vault location" section).
const VAULT_ROOT = `${FileSystem.documentDirectory}vault`;
const fs = createExpoFsAdapter(VAULT_ROOT);

export const vault = {
  listNotes: (tag?: string) => engine.listNotes(fs, tag),
  getNoteById: (id: string) => engine.getNoteById(fs, id),
  createNote: (input: engine.CreateNoteInput) => engine.createNote(fs, input),
  updateNote: (input: engine.UpdateNoteInput) => engine.updateNote(fs, input),
  deleteNote: (id: string) => engine.deleteNote(fs, id),
  search: (query: string) => engine.searchNotes(fs, query),
  getGraph: () => engine.getGraph(fs),
  listTags: () => engine.listTags(fs),
  createAttachment: (input: engine.CreateAttachmentInput) => engine.createAttachment(fs, input),
  listAttachments: (noteId: string) => engine.listAttachments(fs, noteId),
  deleteAttachment: (id: string) => engine.deleteAttachment(fs, id),
  getAttachmentFilePath: (id: string) => engine.getAttachmentFilePath(fs, id),
};
