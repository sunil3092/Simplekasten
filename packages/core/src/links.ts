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
