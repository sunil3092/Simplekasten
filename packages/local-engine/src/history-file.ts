import yaml from "js-yaml";

// A version snapshot's file format — deliberately not note-file.ts's
// parseNoteFile/serializeNoteFile, which require fields (zettelId, type,
// attachmentIds, the review-queue group) that don't apply to a historical
// snapshot. Same `---\n<yaml>\n---\n<body>` shape as a note file, just with
// a minimal frontmatter.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface HistorySnapshot {
  title: string;
  content: string;
  createdAt: string;
}

export function parseHistorySnapshot(raw: string): HistorySnapshot {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error("History snapshot is missing its YAML frontmatter block");
  }

  const frontmatter = (yaml.load(match[1]) ?? {}) as Record<string, unknown>;
  return {
    title: frontmatter.title != null ? String(frontmatter.title) : "Untitled",
    createdAt: frontmatter.createdAt != null ? String(frontmatter.createdAt) : new Date().toISOString(),
    content: match[2] ?? "",
  };
}

export function serializeHistorySnapshot(snapshot: HistorySnapshot): string {
  return `---\n${yaml.dump({ title: snapshot.title, createdAt: snapshot.createdAt })}---\n${snapshot.content}`;
}
