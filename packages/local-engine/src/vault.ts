import { extractHashtags, extractWikiLinkTitles } from "@simplekasten/core";
import { parseCanvasFile, serializeCanvasFile } from "./canvas-file";
import { parseHistorySnapshot, serializeHistorySnapshot, type HistorySnapshot } from "./history-file";
import { parseNoteFile, serializeNoteFile } from "./note-file";
import { addDays, nextReviewState, type ReviewRating } from "./srs";
import { parseTemplateFile, serializeTemplateFile } from "./template-file";
import type {
  Attachment,
  CanvasData,
  CanvasListItem,
  CreateCanvasInput,
  CreateNoteInput,
  CreateTemplateInput,
  FileSystemAdapter,
  GraphData,
  LinkRef,
  NoteDetail,
  NoteListItem,
  SearchResultItem,
  TagItem,
  Template,
  UpdateCanvasInput,
  UpdateNoteInput,
  UpdateTemplateInput,
  VaultNote,
} from "./types";

const NOTES_DIR = "notes";
const TEMPLATES_DIR = "templates";
const CANVASES_DIR = "canvases";
const HISTORY_DIR = ".history";
// One snapshot per this many milliseconds of active editing, not one per
// autosave tick — see version-history.md's "Scope decision" for why.
const SNAPSHOT_COALESCE_MS = 5 * 60 * 1000;
const MAX_VERSIONS_PER_NOTE = 100;

// Sentinel characters wrapped around matches in a search snippet.
// QuickSwitcher's Snippet component splits on these to highlight them without
// parsing the snippet as HTML.
const HL_START = "";
const HL_STOP = "";

function noteFilePath(id: string): string {
  return `${NOTES_DIR}/${id}.md`;
}

// Good enough for a single local writer — there's nothing else to collide with.
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

// Everything below is recomputed from note content on every read, the
// "content is the source of truth, links/tags are derived" rule — there's no
// separate index to keep in sync or go stale.

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

// "2026-09-22" -> "September 22, 2026". Parsed as UTC (the date carries no
// time-of-day meaning — it's a calendar day, not an instant) so the label
// can't shift by a day depending on the machine's local timezone offset.
function formatHumanDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
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
    noteDate: note.noteDate,
    reviewDue: note.reviewDue,
    reviewEase: note.reviewEase,
    reviewInterval: note.reviewInterval,
    reviewReps: note.reviewReps,
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
    noteDate: null,
    reviewDue: null,
    reviewEase: 2.5,
    reviewInterval: 0,
    reviewReps: 0,
  };

  await fs.ensureDir(NOTES_DIR);
  await fs.writeFile(noteFilePath(note.id), serializeNoteFile(note));
  return note;
}

export async function updateNote(fs: FileSystemAdapter, input: UpdateNoteInput): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const existing = notes.find((n) => n.id === input.id && !n.deletedAt);
  if (!existing) throw new Error(`Note "${input.id}" not found`);

  const contentChanged = input.content !== undefined && input.content !== existing.content;
  if (contentChanged) {
    const versions = await listNoteVersions(fs, existing.id);
    const last = versions[0];
    const dueForSnapshot = !last || Date.now() - Date.parse(last.createdAt) > SNAPSHOT_COALESCE_MS;
    if (dueForSnapshot) await writeSnapshot(fs, existing.id, { title: existing.title, content: existing.content });
  }

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

// Get-or-create by calendar date. There's no server round trip to save here
// — "find, then create if missing" is just two in-process passes over the
// already-loaded notes, so a caller never needs to check existence itself
// before asking for "today's" note.
export async function getOrCreateDailyNote(fs: FileSystemAdapter, date: string): Promise<VaultNote> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt);
  const existing = notes.find((n) => n.noteDate === date);
  if (existing) return existing;

  const title = formatHumanDate(date);
  const defaultTemplate = (await loadAllTemplates(fs)).find((t) => t.isDefaultForDailyNote);
  const now = new Date().toISOString();
  const note: VaultNote = {
    id: generateId(),
    zettelId: nextZettelId(notes),
    title,
    content: defaultTemplate ? expandTemplateTokens(defaultTemplate.content, { title }) : "",
    type: "daily",
    noteDate: date,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    attachmentIds: [],
    reviewDue: null,
    reviewEase: 2.5,
    reviewInterval: 0,
    reviewReps: 0,
  };

  await fs.ensureDir(NOTES_DIR);
  await fs.writeFile(noteFilePath(note.id), serializeNoteFile(note));
  return note;
}

// Most recent daily notes, newest first — powers the sidebar's Journal
// section (desktop) and nothing on mobile yet (see docs/features/daily-notes.md).
export async function listDailyNotes(fs: FileSystemAdapter, limit = 30): Promise<NoteListItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt && n.type === "daily");
  return notes
    .slice()
    .sort((a, b) => (b.noteDate ?? "").localeCompare(a.noteDate ?? ""))
    .slice(0, limit)
    .map(({ id, zettelId, title, type, updatedAt }) => ({ id, zettelId, title, type, updatedAt }));
}

function templateFilePath(id: string): string {
  return `${TEMPLATES_DIR}/${id}.md`;
}

async function loadAllTemplates(fs: FileSystemAdapter): Promise<Template[]> {
  await fs.ensureDir(TEMPLATES_DIR);
  const files = await fs.listFiles(TEMPLATES_DIR);
  const templates: Template[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const id = file.slice(0, -3);
    const raw = await fs.readFile(templateFilePath(id));
    templates.push(parseTemplateFile(raw, id));
  }
  return templates;
}

// Expanded at apply time, never stored expanded, so editing a template
// later only affects future uses of it.
function expandTemplateTokens(content: string, ctx: { title: string }): string {
  const now = new Date();
  return content
    .replaceAll("{{date}}", now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))
    .replaceAll("{{time}}", now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
    .replaceAll("{{title}}", ctx.title);
}

export async function listTemplates(fs: FileSystemAdapter): Promise<Template[]> {
  const templates = await loadAllTemplates(fs);
  return templates.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTemplate(fs: FileSystemAdapter, input: CreateTemplateInput): Promise<Template> {
  const now = new Date().toISOString();
  const template: Template = {
    id: generateId(),
    name: input.name,
    content: input.content,
    isDefaultForDailyNote: false,
    createdAt: now,
    updatedAt: now,
  };
  await fs.ensureDir(TEMPLATES_DIR);
  await fs.writeFile(templateFilePath(template.id), serializeTemplateFile(template));
  return template;
}

export async function updateTemplate(fs: FileSystemAdapter, input: UpdateTemplateInput): Promise<Template> {
  const templates = await loadAllTemplates(fs);
  const existing = templates.find((t) => t.id === input.id);
  if (!existing) throw new Error(`Template "${input.id}" not found`);

  const updated: Template = {
    ...existing,
    name: input.name ?? existing.name,
    content: input.content ?? existing.content,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(templateFilePath(updated.id), serializeTemplateFile(updated));
  return updated;
}

export async function deleteTemplate(fs: FileSystemAdapter, id: string): Promise<void> {
  const templates = await loadAllTemplates(fs);
  if (!templates.some((t) => t.id === id)) throw new Error(`Template "${id}" not found`);
  await fs.deleteFile(templateFilePath(id));
}

// At most one template carries isDefaultForDailyNote — there's no
// transaction to reach for in a file-per-record store, so "read all, write
// the ones that changed" (the previous default, if any, and the new one)
// is the whole mechanism.
export async function setDefaultForDailyNote(fs: FileSystemAdapter, id: string): Promise<Template> {
  const templates = await loadAllTemplates(fs);
  const target = templates.find((t) => t.id === id);
  if (!target) throw new Error(`Template "${id}" not found`);

  const previousDefault = templates.find((t) => t.isDefaultForDailyNote && t.id !== id);
  if (previousDefault) {
    const cleared = { ...previousDefault, isDefaultForDailyNote: false };
    await fs.writeFile(templateFilePath(cleared.id), serializeTemplateFile(cleared));
  }

  const updated = { ...target, isDefaultForDailyNote: true, updatedAt: new Date().toISOString() };
  await fs.writeFile(templateFilePath(updated.id), serializeTemplateFile(updated));
  return updated;
}

// Appends the template's expanded content to the note's current body —
// append, not replace, so applying a template never destroys existing text.
export async function applyTemplate(fs: FileSystemAdapter, input: { noteId: string; templateId: string }): Promise<NoteDetail> {
  const templates = await loadAllTemplates(fs);
  const template = templates.find((t) => t.id === input.templateId);
  if (!template) throw new Error(`Template "${input.templateId}" not found`);

  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === input.noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${input.noteId}" not found`);

  const expanded = expandTemplateTokens(template.content, { title: note.title });
  const separator = note.content.length > 0 ? "\n\n" : "";
  await updateNote(fs, { id: note.id, content: `${note.content}${separator}${expanded}` });

  const detail = await getNoteById(fs, note.id);
  if (!detail) throw new Error(`Note "${input.noteId}" not found`);
  return detail;
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
 * title-match-first then most-recently-updated — simple, but this is a single local vault, not a corpus.
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

// Any note can be added to the review queue — restricting by type (e.g.
// permanent-only) would be arbitrary, since the queue is opt-in per note
// either way. Due immediately (today) so a freshly-added note shows up in
// the very next review session rather than waiting.
export async function addToReviewQueue(fs: FileSystemAdapter, noteId: string, today: string): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${noteId}" not found`);

  const updated: VaultNote = { ...note, reviewDue: today, reviewEase: 2.5, reviewInterval: 0, reviewReps: 0 };
  await fs.writeFile(noteFilePath(updated.id), serializeNoteFile(updated));
  return updated;
}

// Resets to the "never reviewed" defaults — re-adding later starts fresh,
// not from wherever progress left off. Simplest correct behavior for v1.
export async function removeFromReviewQueue(fs: FileSystemAdapter, noteId: string): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${noteId}" not found`);

  const updated: VaultNote = { ...note, reviewDue: null, reviewEase: 2.5, reviewInterval: 0, reviewReps: 0 };
  await fs.writeFile(noteFilePath(updated.id), serializeNoteFile(updated));
  return updated;
}

export async function listDueForReview(fs: FileSystemAdapter, date: string): Promise<NoteListItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt && n.reviewDue !== null && n.reviewDue <= date);
  return notes
    .slice()
    .sort((a, b) => (a.reviewDue as string).localeCompare(b.reviewDue as string))
    .map(({ id, zettelId, title, type, updatedAt }) => ({ id, zettelId, title, type, updatedAt }));
}

export interface SubmitReviewInput {
  noteId: string;
  rating: ReviewRating;
  today: string;
}

export async function submitReview(fs: FileSystemAdapter, input: SubmitReviewInput): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const note = notes.find((n) => n.id === input.noteId && !n.deletedAt);
  if (!note) throw new Error(`Note "${input.noteId}" not found`);

  const next = nextReviewState({ ease: note.reviewEase, interval: note.reviewInterval, reps: note.reviewReps }, input.rating);
  const updated: VaultNote = {
    ...note,
    reviewEase: next.ease,
    reviewInterval: next.interval,
    reviewReps: next.reps,
    reviewDue: addDays(input.today, next.interval),
  };
  await fs.writeFile(noteFilePath(updated.id), serializeNoteFile(updated));
  return updated;
}

function historyDir(noteId: string): string {
  return `${HISTORY_DIR}/${noteId}`;
}

function historyFilePath(noteId: string, versionId: string): string {
  return `${historyDir(noteId)}/${versionId}.md`;
}

export interface NoteVersion {
  id: string;
  createdAt: string;
  title: string;
}

export async function listNoteVersions(fs: FileSystemAdapter, noteId: string): Promise<NoteVersion[]> {
  await fs.ensureDir(historyDir(noteId));
  const files = await fs.listFiles(historyDir(noteId));
  const versions: NoteVersion[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const id = file.slice(0, -3);
    const snapshot = parseHistorySnapshot(await fs.readFile(historyFilePath(noteId, id)));
    versions.push({ id, createdAt: snapshot.createdAt, title: snapshot.title });
  }
  // Newest first — versionId (generateId()'s base36 timestamp prefix) sorts
  // lexically by creation time, but createdAt is the source of truth.
  return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getNoteVersion(fs: FileSystemAdapter, noteId: string, versionId: string): Promise<HistorySnapshot> {
  return parseHistorySnapshot(await fs.readFile(historyFilePath(noteId, versionId)));
}

async function writeSnapshot(fs: FileSystemAdapter, noteId: string, snapshot: { title: string; content: string }): Promise<void> {
  await fs.ensureDir(historyDir(noteId));
  const id = generateId();
  await fs.writeFile(historyFilePath(noteId, id), serializeHistorySnapshot({ ...snapshot, createdAt: new Date().toISOString() }));

  // Prune past the cap, oldest first — a safety bound against pathological
  // cases, not a real-world limit under the 5-minute coalescing window.
  const versions = await listNoteVersions(fs, noteId);
  for (const stale of versions.slice(MAX_VERSIONS_PER_NOTE)) {
    await fs.deleteFile(historyFilePath(noteId, stale.id));
  }
}

export async function restoreNoteVersion(fs: FileSystemAdapter, noteId: string, versionId: string): Promise<VaultNote> {
  const notes = await loadAllNotes(fs);
  const existing = notes.find((n) => n.id === noteId && !n.deletedAt);
  if (!existing) throw new Error(`Note "${noteId}" not found`);

  const target = await getNoteVersion(fs, noteId, versionId);

  // Restoring is a deliberate, infrequent action, not an autosave tick, so
  // the 5-minute coalescing window doesn't apply — always snapshot the
  // current state first, so restoring is itself reversible.
  await writeSnapshot(fs, noteId, { title: existing.title, content: existing.content });

  const updated: VaultNote = { ...existing, title: target.title, content: target.content, updatedAt: new Date().toISOString() };
  await fs.writeFile(noteFilePath(updated.id), serializeNoteFile(updated));
  return updated;
}

function canvasFilePath(id: string): string {
  return `${CANVASES_DIR}/${id}.json`;
}

async function loadAllCanvases(fs: FileSystemAdapter): Promise<CanvasData[]> {
  await fs.ensureDir(CANVASES_DIR);
  const files = await fs.listFiles(CANVASES_DIR);
  const canvases: CanvasData[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const id = file.slice(0, -5);
    const raw = await fs.readFile(canvasFilePath(id));
    canvases.push(parseCanvasFile(raw, id));
  }
  return canvases;
}

export async function listCanvases(fs: FileSystemAdapter): Promise<CanvasListItem[]> {
  const canvases = await loadAllCanvases(fs);
  return canvases
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export async function createCanvas(fs: FileSystemAdapter, input: CreateCanvasInput): Promise<CanvasData> {
  const now = new Date().toISOString();
  const canvas: CanvasData = { id: generateId(), title: input.title, cards: [], createdAt: now, updatedAt: now };
  await fs.ensureDir(CANVASES_DIR);
  await fs.writeFile(canvasFilePath(canvas.id), serializeCanvasFile(canvas));
  return canvas;
}

export async function getCanvas(fs: FileSystemAdapter, id: string): Promise<CanvasData> {
  const raw = await fs.readFile(canvasFilePath(id));
  return parseCanvasFile(raw, id);
}

// cards is replaced wholesale, not diffed/merged — same "the debounced save
// writes the full current state" model note content already uses; a
// canvas is small enough that this is never a real cost.
export async function updateCanvas(fs: FileSystemAdapter, input: UpdateCanvasInput): Promise<CanvasData> {
  const existing = await getCanvas(fs, input.id);
  const updated: CanvasData = {
    ...existing,
    title: input.title ?? existing.title,
    cards: input.cards ?? existing.cards,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(canvasFilePath(updated.id), serializeCanvasFile(updated));
  return updated;
}

export async function deleteCanvas(fs: FileSystemAdapter, id: string): Promise<void> {
  const canvases = await loadAllCanvases(fs);
  if (!canvases.some((c) => c.id === id)) throw new Error(`Canvas "${id}" not found`);
  await fs.deleteFile(canvasFilePath(id));
}
