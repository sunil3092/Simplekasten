const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Pulls every `[[Target]]` (or `[[Target|alias]]`) reference out of a note's
 * markdown body. Case-sensitive, de-duplicated, order-preserved.
 */
export function extractWikiLinkTitles(content: string): string[] {
  const seen = new Set<string>();
  for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
    const title = match[1].trim();
    if (title) seen.add(title);
  }
  return [...seen];
}

// Excludes markdown headings ("# Heading", "## Sub") by requiring the `#` to
// be immediately followed by a letter, not a space or another `#`, and not
// preceded by a word character or `#` itself.
const HASHTAG_PATTERN = /(?<![#\w])#([a-zA-Z][\w/-]*)/g;

/** Pulls every `#hashtag` out of a note's body, lowercased and de-duplicated. */
export function extractHashtags(content: string): string[] {
  const seen = new Set<string>();
  for (const match of content.matchAll(HASHTAG_PATTERN)) {
    seen.add(match[1].toLowerCase());
  }
  return [...seen];
}
