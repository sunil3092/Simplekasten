import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";

// A version snapshot's file format — deliberately not note-file.ts's
// parseNoteFile/serializeNoteFile, which require fields (zettelId, type,
// attachmentIds, the review-queue group) that don't apply to a historical
// snapshot. Same stored file shape (see frontmatter.ts), just with a
// minimal frontmatter.

export interface HistorySnapshot {
  title: string;
  content: string;
  createdAt: string;
}

export function parseHistorySnapshot(raw: string): HistorySnapshot {
  const { frontmatter, body } = parseFrontmatter(raw, "History snapshot");
  return {
    title: frontmatter.title != null ? String(frontmatter.title) : "Untitled",
    createdAt: frontmatter.createdAt != null ? String(frontmatter.createdAt) : new Date().toISOString(),
    content: body,
  };
}

export function serializeHistorySnapshot(snapshot: HistorySnapshot): string {
  return serializeFrontmatter({ title: snapshot.title, createdAt: snapshot.createdAt }, snapshot.content);
}
