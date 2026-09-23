import yaml from "js-yaml";
import type { NoteType } from "@simplekasten/core";
import type { VaultNote } from "./types";

// A note file is always `---\n<yaml>\n---\n<body>` — the filename (its id)
// is what's stable across edits, so a title change never renames the file.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseNoteFile(raw: string, id: string): VaultNote {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`Note file "${id}.md" is missing its YAML frontmatter block`);
  }

  const frontmatter = (yaml.load(match[1]) ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id,
    zettelId: frontmatter.zettelId != null ? String(frontmatter.zettelId) : "",
    title: frontmatter.title != null ? String(frontmatter.title) : "Untitled",
    type: (frontmatter.type as NoteType) ?? "fleeting",
    content: match[2] ?? "",
    createdAt: frontmatter.createdAt != null ? String(frontmatter.createdAt) : now,
    updatedAt: frontmatter.updatedAt != null ? String(frontmatter.updatedAt) : now,
    deletedAt: frontmatter.deletedAt != null ? String(frontmatter.deletedAt) : null,
    attachmentIds: Array.isArray(frontmatter.attachmentIds) ? frontmatter.attachmentIds.map(String) : [],
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
  if (note.noteDate) frontmatter.noteDate = note.noteDate;
  if (note.reviewDue) {
    frontmatter.reviewDue = note.reviewDue;
    frontmatter.reviewEase = note.reviewEase;
    frontmatter.reviewInterval = note.reviewInterval;
    frontmatter.reviewReps = note.reviewReps;
  }

  return `---\n${yaml.dump(frontmatter)}---\n${note.content}`;
}
