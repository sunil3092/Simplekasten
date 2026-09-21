import { extractHashtags, extractWikiLinkTitles } from "@simplekasten/core";
import { parseNoteFile, serializeNoteFile } from "./note-file";
import type {
  Attachment,
  CreateNoteInput,
  FileSystemAdapter,
  GraphData,
  LinkRef,
  NoteDetail,
  NoteListItem,
  SearchResultItem,
  TagItem,
  UpdateNoteInput,
  VaultNote,
} from "./types";

const NOTES_DIR = "notes";

// Same sentinel characters Postgres's ts_headline wraps matches in on the
// server (see apps/api/src/routes/notes.ts) — QuickSwitcher's Snippet
// component already splits on these, so it needs no changes to render a
// locally-computed snippet.
const HL_START = "";
const HL_STOP = "";

function noteFilePath(id: string): string {
  return `${NOTES_DIR}/${id}.md`;
}

// Good enough for a single local writer — no server round-trip to collide
// with, unlike a shared Postgres sequence.
function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function loadAllNotes(fs: FileSystemAdapter): Promise<VaultNote[]> {
  await fs.ensureDir(NOTES_DIR);
  const files = await fs.listFiles(NOTES_DIR);
  const notes: VaultNote[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const id = file.slice(0, -3);
    const raw = await fs.readFile(noteFilePath(id));
    notes.push(parseNoteFile(raw, id));
  }
  return notes;
}

// Everything below is recomputed from note content on every read, the same
// "content is the source of truth, links/tags are derived" rule the API
// uses (see apps/api/src/links.ts) — there's no separate index to keep in
// sync or go stale.

function computeLinks(notes: VaultNote[]): LinkRef[] {
  const byLowerTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));
  const links: LinkRef[] = [];
  for (const note of notes) {
    for (const title of extractWikiLinkTitles(note.content)) {
      const targetNoteId = byLowerTitle.get(title.toLowerCase()) ?? null;
      links.push({
        sourceNoteId: note.id,
        targetTitle: title,
        targetNoteId,
        resolved: targetNoteId !== null,
      });
    }
  }
  return links;
}

/** tag name (lowercase) -> ids of notes containing that #hashtag. */
function computeTags(notes: VaultNote[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const note of notes) {
    for (const name of extractHashtags(note.content)) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name)!.add(note.id);
    }
  }
  return map;
}

function nextZettelId(notes: VaultNote[]): string {
  let max = 0;
  for (const note of notes) {
    const n = Number(note.zettelId);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

// Titles are what [[wiki links]] resolve against, and the link pattern can't
// match a target that itself contains "]]" — a title like "Foo [[Bar]]" could
// never be linked to. Strip the brackets so every title stays linkable.
function sanitizeTitle(title: string): string {
  return title.replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim();
}

export async function listNotes(fs: FileSystemAdapter, tag?: string): Promise<NoteListItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);

  let filtered = notes;
  if (tag) {
    const noteIds = computeTags(notes).get(tag.toLowerCase()) ?? new Set<string>();
    filtered = notes.filter((n) => noteIds.has(n.id));
  }

  return filtered
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, zettelId, title, type, updatedAt }) => ({ id, zettelId, title, type, updatedAt }));
}

export async function getNoteById(fs: FileSystemAdapter, id: string): Promise<NoteDetail | null> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  const note = notes.find((n) => n.id === id);
  if (!note) return null;

  const byId = new Map(notes.map((n) => [n.id, n]));
  const links = computeLinks(notes);
  const tagNames = [...computeTags(notes).entries()]
    .filter(([, ids]) => ids.has(id))
    .map(([name]) => name)
    .sort();

  return {
    id: note.id,
    zettelId: note.zettelId,
    title: note.title,
    content: note.content,
    type: note.type,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tagNames,
    attachments: await listAttachments(fs, id),
    backlinks: links
      .filter((l) => l.targetNoteId === id && l.resolved)
      .map((l) => {
        const source = byId.get(l.sourceNoteId)!;
        return { noteId: source.id, title: source.title, zettelId: source.zettelId };
      }),
    contents: links
      .filter((l) => l.sourceNoteId === id)
      .map((l) => {
        const target = l.targetNoteId ? byId.get(l.targetNoteId) : undefined;
        return {
          noteId: target?.id ?? null,
          title: target?.title ?? l.targetTitle,
          zettelId: target?.zettelId ?? null,
          resolved: l.resolved,
        };
      }),
  };
}

export async function createNote(fs: FileSystemAdapter, input: CreateNoteInput): Promise<VaultNote> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  const now = new Date().toISOString();
  const note: VaultNote = {
    id: generateId(),
    zettelId: nextZettelId(notes),
    title: sanitizeTitle(input.title),
    content: input.content,
    type: input.type ?? "fleeting",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    attachmentIds: [],
  };

  await fs.ensureDir(NOTES_DIR);
  await fs.writeFile(noteFilePath(note.id), serializeNoteFile(note));
  return note;
}

export async function updateNote(fs: FileSystemAdapter, input: UpdateNoteInput): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const existing = notes.find((n) => n.id === input.id && !n.deletedAt);
  if (!existing) throw new Error(`Note "${input.id}" not found`);

  const updated: VaultNote = {
    ...existing,
    title: input.title !== undefined ? sanitizeTitle(input.title) : existing.title,
    content: input.content ?? existing.content,
    type: input.type ?? existing.type,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(noteFilePath(updated.id), serializeNoteFile(updated));
  return updated;
}

/** Soft delete, same as the API — the file stays on disk with `deletedAt` set. */
export async function deleteNote(fs: FileSystemAdapter, id: string): Promise<void> {
  const notes = await loadAllNotes(fs);
  const existing = notes.find((n) => n.id === id);
  if (!existing) throw new Error(`Note "${id}" not found`);

  await fs.writeFile(noteFilePath(id), serializeNoteFile({ ...existing, deletedAt: new Date().toISOString() }));
}

export async function listTags(fs: FileSystemAdapter): Promise<TagItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  return [...computeTags(notes).entries()]
    .map(([name, ids]) => ({ id: name, name, noteCount: ids.size }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGraph(fs: FileSystemAdapter): Promise<GraphData> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  const edges = computeLinks(notes).filter((l) => l.resolved && l.targetNoteId);

  return {
    nodes: notes.map(({ id, title, zettelId, type }) => ({ id, title, zettelId, type })),
    edges: edges.map((l) => ({ source: l.sourceNoteId, target: l.targetNoteId! })),
  };
}

function buildSnippet(content: string, matchIndex: number | null, matchLength: number): string {
  const WINDOW = 60;
  if (matchIndex === null) {
    return content.length > 120 ? `${content.slice(0, 120)}…` : content;
  }

  const start = Math.max(0, matchIndex - WINDOW);
  const end = Math.min(content.length, matchIndex + matchLength + WINDOW);
  const before = content.slice(start, matchIndex);
  const match = content.slice(matchIndex, matchIndex + matchLength);
  const after = content.slice(matchIndex + matchLength, end);

  return `${start > 0 ? "…" : ""}${before}${HL_START}${match}${HL_STOP}${after}${end < content.length ? "…" : ""}`;
}

/**
 * Plain case-insensitive substring match over title+content, ranked
 * title-match-first then most-recently-updated — nowhere near Postgres's
 * ranked full-text search, but this is a single local vault, not a corpus.
 */
export async function searchNotes(fs: FileSystemAdapter, query: string): Promise<SearchResultItem[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);

  const scored: { item: SearchResultItem; titleMatch: boolean; updatedAt: string }[] = [];
  for (const note of notes) {
    const titleIdx = note.title.toLowerCase().indexOf(q);
    const contentIdx = note.content.toLowerCase().indexOf(q);
    if (titleIdx === -1 && contentIdx === -1) continue;

    const snippet =
      contentIdx !== -1 ? buildSnippet(note.content, contentIdx, q.length) : buildSnippet(note.content, null, 0);

    scored.push({
      item: { id: note.id, title: note.title, zettelId: note.zettelId, snippet },
      titleMatch: titleIdx !== -1,
      updatedAt: note.updatedAt,
    });
  }

  return scored
    .sort((a, b) => {
      if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 20)
    .map((s) => s.item);
}

const ATTACHMENTS_DIR = "attachments";
const MANIFEST_PATH = `${ATTACHMENTS_DIR}/manifest.json`;

function kindForMimeType(mimeType: string): "photo" | "voice" | null {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("audio/")) return "voice";
  return null;
}

function attachmentFilename(attachment: Pick<Attachment, "id" | "filename">): string {
  return `${attachment.id}-${attachment.filename}`;
}

/**
 * The stored `Attachment.filename` is both the display name and part of the
 * on-disk path, so sanitizing once here — at the point the attachment record
 * is built — keeps the two from ever diverging. A `/` or `..` in a
 * picker-supplied filename would otherwise escape `attachments/`.
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.-]/g, "_");
}

async function loadManifest(fs: FileSystemAdapter): Promise<Record<string, Attachment>> {
  if (!(await fs.exists(MANIFEST_PATH))) return {};
  const raw = await fs.readFile(MANIFEST_PATH);
  try {
    return JSON.parse(raw) as Record<string, Attachment>;
  } catch (err) {
    throw new Error(
      `Attachment manifest at "${MANIFEST_PATH}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function saveManifest(fs: FileSystemAdapter, manifest: Record<string, Attachment>): Promise<void> {
  await fs.ensureDir(ATTACHMENTS_DIR);
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export interface CreateAttachmentInput {
  noteId: string;
  sourcePath: string;
  filename: string;
  mimeType: string;
}

export async function createAttachment(fs: FileSystemAdapter, input: CreateAttachmentInput): Promise<Attachment> {
  const kind = kindForMimeType(input.mimeType);
  if (!kind) {
    throw new Error(`Unsupported attachment mime type "${input.mimeType}" — only image/* and audio/* are supported`);
  }

  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === input.noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${input.noteId}" not found`);

  const attachment: Attachment = {
    id: generateId(),
    noteId: input.noteId,
    kind,
    filename: sanitizeFilename(input.filename),
    mimeType: input.mimeType,
    createdAt: new Date().toISOString(),
  };

  await fs.ensureDir(ATTACHMENTS_DIR);
  await fs.copyFile(input.sourcePath, `${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);

  const manifest = await loadManifest(fs);
  manifest[attachment.id] = attachment;
  await saveManifest(fs, manifest);

  // Re-read rather than reusing the `note` captured above: copying a
  // multi-megabyte photo or voice file is slow enough that an autosave can
  // land in between, and writing back the stale object would discard it.
  const fresh = (await loadAllNotes(fs)).find((n) => n.id === input.noteId);
  if (fresh) {
    await fs.writeFile(
      noteFilePath(fresh.id),
      serializeNoteFile({
        ...fresh,
        attachmentIds: [...fresh.attachmentIds, attachment.id],
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  return attachment;
}

export async function listAttachments(fs: FileSystemAdapter, noteId: string): Promise<Attachment[]> {
  const manifest = await loadManifest(fs);
  return Object.values(manifest)
    .filter((a) => a.noteId === noteId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteAttachment(fs: FileSystemAdapter, id: string): Promise<void> {
  const manifest = await loadManifest(fs);
  const attachment = manifest[id];
  if (!attachment) throw new Error(`Attachment "${id}" not found`);

  delete manifest[id];
  await saveManifest(fs, manifest);
  await fs.deleteFile(`${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);

  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === attachment.noteId);
  if (note) {
    await fs.writeFile(
      noteFilePath(note.id),
      serializeNoteFile({
        ...note,
        attachmentIds: note.attachmentIds.filter((attachmentId) => attachmentId !== id),
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}

export async function getAttachmentFilePath(fs: FileSystemAdapter, id: string): Promise<string> {
  const manifest = await loadManifest(fs);
  const attachment = manifest[id];
  if (!attachment) throw new Error(`Attachment "${id}" not found`);
  return fs.resolvePath(`${ATTACHMENTS_DIR}/${attachmentFilename(attachment)}`);
}
