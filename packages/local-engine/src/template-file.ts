import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import type { Template } from "./types";

// Same stored file shape as note files (see frontmatter.ts). The filename
// (its id) is stable across renames — renaming a template never moves its
// file.

export function parseTemplateFile(raw: string, id: string): Template {
  const { frontmatter, body } = parseFrontmatter(raw, `Template file "${id}.md"`);
  const now = new Date().toISOString();

  return {
    id,
    name: frontmatter.name != null ? String(frontmatter.name) : "Untitled template",
    content: body,
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

  return serializeFrontmatter(frontmatter, template.content);
}
