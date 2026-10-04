import type { NoteType } from "@simplekasten/core";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import type { VaultNote } from "./types";

// The filename (its id) is what's stable across edits, so a title change
// never renames the file. The stored file shape itself lives in
// frontmatter.ts, shared with templates and history snapshots.

export function parseNoteFile(raw: string, id: string): VaultNote {
  const { frontmatter, body } = parseFrontmatter(raw, `Note file "${id}.md"`);
  const now = new Date().toISOString();

  return {
    id,
    zettelId: frontmatter.zettelId != null ? String(frontmatter.zettelId) : "",
    title: frontmatter.title != null ? String(frontmatter.title) : "Untitled",
    type: (frontmatter.type as NoteType) ?? "fleeting",
    content: body,
    createdAt: frontmatter.createdAt != null ? String(frontmatter.createdAt) : now,
    updatedAt: frontmatter.updatedAt != null ? String(frontmatter.updatedAt) : now,
    deletedAt: frontmatter.deletedAt != null ? String(frontmatter.deletedAt) : null,
    attachmentIds: Array.isArray(frontmatter.attachmentIds) ? frontmatter.attachmentIds.map(String) : [],
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    noteDate: frontmatter.noteDate != null ? String(frontmatter.noteDate) : null,
    reviewDue: frontmatter.reviewDue != null ? String(frontmatter.reviewDue) : null,
    reviewEase: typeof frontmatter.reviewEase === "number" ? frontmatter.reviewEase : 2.5,
    reviewInterval: typeof frontmatter.reviewInterval === "number" ? frontmatter.reviewInterval : 0,
    reviewReps: typeof frontmatter.reviewReps === "number" ? frontmatter.reviewReps : 0,
  };
}

export function serializeNoteFile(note: VaultNote): string {
  const frontmatter: Record<string, unknown> = {
    id: note.id,
    zettelId: note.zettelId,
    title: note.title,
    type: note.type,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  if (note.deletedAt) frontmatter.deletedAt = note.deletedAt;
  if (note.attachmentIds.length > 0) frontmatter.attachmentIds = note.attachmentIds;
  // Tags are optional — only written once a note actually has some.
  if (note.tags.length > 0) frontmatter.tags = note.tags;
  if (note.noteDate) frontmatter.noteDate = note.noteDate;
  if (note.reviewDue) {
    frontmatter.reviewDue = note.reviewDue;
    frontmatter.reviewEase = note.reviewEase;
    frontmatter.reviewInterval = note.reviewInterval;
    frontmatter.reviewReps = note.reviewReps;
  }

  return serializeFrontmatter(frontmatter, note.content);
}
