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

/**
 * The tag every journal (daily) note carries without it being typed or
 * assigned, so journal entries can always be picked out — or left out — by
 * tag. Lowercase like every stored tag name: "#JournalEntry" in a note's text
 * means the same tag.
 */
export const JOURNAL_TAG = "journalentry";

/**
 * The body text that gives a note these tags: one `#hashtag` each. The journal
 * tag is left out — it comes from a note being a journal entry, not from text.
 */
export function hashtagLine(tags: string[]): string {
  return tags
    .filter((tag) => tag !== JOURNAL_TAG)
    .map((tag) => `#${tag}`)
    .join(" ");
}

const TAG_NAME_PATTERN =/^[a-z][\w/-]*$/;

/**
 * Normalises a tag typed into a tag picker to the form a #hashtag would
 * produce (trimmed, no leading `#`, lowercase), or returns null if a hashtag
 * couldn't express it — so assigned tags and #hashtags stay one namespace.
 */
export function normalizeTagName(input: string): string | null {
  const name = input.trim().replace(/^#/, "").toLowerCase();
  return TAG_NAME_PATTERN.test(name) ? name : null;
}
