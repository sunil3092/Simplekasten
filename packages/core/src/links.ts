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

// ---- Suggestions while typing ----------------------------------------------
// What mobile's plain text fields use to offer note titles after `[[` and
// existing tags after `#`. Desktop's editor has its own completion sources
// (CodeMirror needs them in its shape); the patterns are the same.

// The query can't run past a line break or another bracket: an unclosed [[
// further up would otherwise swallow everything typed after it.
const OPEN_LINK_PATTERN = /\[\[([^\][|\n]*)$/;
// The rest of a tag after the cursor, when a suggestion is applied mid-tag.
const TAG_TAIL_PATTERN = /^[\w/-]*/;
const OPEN_TAG_PATTERN = /(?<![#\w])#([\w/-]*)$/;

export interface TypingSuggestion {
  kind: "link" | "tag";
  /** What has been typed so far after the `[[` or `#`. */
  query: string;
  /** Where the query starts in the text. */
  from: number;
}

/** The `[[link` or `#tag` being typed just before the cursor, if any. */
export function typingSuggestion(text: string, cursor: number): TypingSuggestion | null {
  const before = text.slice(0, cursor);
  const link = OPEN_LINK_PATTERN.exec(before);
  if (link) return { kind: "link", query: link[1], from: cursor - link[1].length };
  const tag = OPEN_TAG_PATTERN.exec(before);
  if (tag) return { kind: "tag", query: tag[1], from: cursor - tag[1].length };
  return null;
}

/** Titles or tags to offer for what is being typed, best `limit` of them. */
export function matchingSuggestions(suggestion: TypingSuggestion, titles: string[], tags: string[], limit = 8): string[] {
  const query = suggestion.query.toLowerCase();
  const pool = suggestion.kind === "link" ? titles : tags.filter((tag) => tag.toLowerCase() !== query);
  return pool.filter((item) => item.toLowerCase().includes(query)).slice(0, limit);
}

/** The text with the suggestion filled in, and where the cursor belongs afterwards. */
export function applyTypingSuggestion(text: string, cursor: number, suggestion: TypingSuggestion, value: string): { text: string; cursor: number } {
  const after = text.slice(cursor);
  if (suggestion.kind === "tag") {
    const rest = after.replace(TAG_TAIL_PATTERN, "");
    return { text: text.slice(0, suggestion.from) + value + rest, cursor: suggestion.from + value.length };
  }
  const hasClosing = after.startsWith("]]");
  const insert = hasClosing ? value : `${value}]]`;
  return { text: text.slice(0, suggestion.from) + insert + after, cursor: suggestion.from + insert.length + (hasClosing ? 2 : 0) };
}
