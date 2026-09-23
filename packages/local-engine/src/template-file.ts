import yaml from "js-yaml";
import type { Template } from "./types";

// Same shape as note-file.ts's note files: `---\n<yaml>\n---\n<body>`. The
// filename (its id) is stable across renames — renaming a template never
// moves its file.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseTemplateFile(raw: string, id: string): Template {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`Template file "${id}.md" is missing its YAML frontmatter block`);
  }

  const frontmatter = (yaml.load(match[1]) ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id,
    name: frontmatter.name != null ? String(frontmatter.name) : "Untitled template",
    content: match[2] ?? "",
    isDefaultForDailyNote: frontmatter.isDefaultForDailyNote === true,
    createdAt: frontmatter.createdAt != null ? String(frontmatter.createdAt) : now,
    updatedAt: frontmatter.updatedAt != null ? String(frontmatter.updatedAt) : now,
  };
}

export function serializeTemplateFile(template: Template): string {
  const frontmatter: Record<string, unknown> = {
    id: template.id,
    name: template.name,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
  if (template.isDefaultForDailyNote) frontmatter.isDefaultForDailyNote = true;

  return `---\n${yaml.dump(frontmatter)}---\n${template.content}`;
}
