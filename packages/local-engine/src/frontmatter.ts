import yaml from "js-yaml";

// Every markdown file this engine stores — notes, templates, history
// snapshots — is `---\n<yaml>\n---\n<body>`. One definition of that shape
// here means the three can't drift apart; what differs between them is only
// which frontmatter fields they read, which stays in their own modules.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Splits a stored file into its parsed frontmatter and its raw body.
 * `what` names the file in the error thrown when the block is missing
 * (e.g. `Note file "abc.md"`), so the message points at the actual file.
 */
export function parseFrontmatter(raw: string, what: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`${what} is missing its YAML frontmatter block`);
  }
  return {
    frontmatter: (yaml.load(match[1]) ?? {}) as Record<string, unknown>,
    body: match[2] ?? "",
  };
}

export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${yaml.dump(frontmatter)}---\n${body}`;
}
