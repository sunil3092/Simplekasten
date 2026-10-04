import { describe, expect, it } from "vitest";
import {
  applyTypingSuggestion,
  extractHashtags,
  extractWikiLinkTitles,
  hashtagLine,
  JOURNAL_TAG,
  matchingSuggestions,
  normalizeTagName,
  typingSuggestion,
} from "./links";

describe("extractWikiLinkTitles", () => {
  it("pulls a single [[Title]] reference", () => {
    expect(extractWikiLinkTitles("See [[Atomicity]] for details.")).toEqual(["Atomicity"]);
  });

  it("supports the [[Target|alias]] display-text form, keeping only the target", () => {
    expect(extractWikiLinkTitles("As discussed in [[Atomicity|the atomicity note]].")).toEqual(["Atomicity"]);
  });

  it("de-duplicates repeated links while preserving first-seen order", () => {
    expect(extractWikiLinkTitles("[[B]] then [[A]] then [[B]] again")).toEqual(["B", "A"]);
  });

  it("trims surrounding whitespace inside the brackets", () => {
    expect(extractWikiLinkTitles("[[ Spaced Title ]]")).toEqual(["Spaced Title"]);
  });

  it("returns an empty array when there are no links", () => {
    expect(extractWikiLinkTitles("Just plain text, no brackets here.")).toEqual([]);
  });

  it("ignores an empty [[]] pair", () => {
    expect(extractWikiLinkTitles("Nothing here: [[]]")).toEqual([]);
  });

  it("handles multiple distinct links in one note", () => {
    expect(extractWikiLinkTitles("Links to [[One]], [[Two]], and [[Three]].")).toEqual(["One", "Two", "Three"]);
  });
});

describe("extractHashtags", () => {
  it("pulls a simple #hashtag", () => {
    expect(extractHashtags("A note about #zettelkasten.")).toEqual(["zettelkasten"]);
  });

  it("lowercases tags so #Tag and #tag collapse to one", () => {
    expect(extractHashtags("#Evolution and #evolution and #EVOLUTION")).toEqual(["evolution"]);
  });

  it("does not treat a markdown heading as a tag", () => {
    expect(extractHashtags("# Heading one\n## Heading two\ncontent")).toEqual([]);
  });

  it("still matches a hashtag on the same line as heading-like text", () => {
    expect(extractHashtags("# Heading #tag-at-end")).toEqual(["tag-at-end"]);
  });

  it("does not match a bare # followed by nothing alphabetic", () => {
    expect(extractHashtags("Price: #1 best seller, #!not-a-tag")).toEqual([]);
  });

  it("allows hyphens and slashes in tag names", () => {
    expect(extractHashtags("#area/sub-topic is a nested-style tag")).toEqual(["area/sub-topic"]);
  });

  it("de-duplicates and preserves first-seen order", () => {
    expect(extractHashtags("#b #a #b")).toEqual(["b", "a"]);
  });

  it("returns an empty array when there are no hashtags", () => {
    expect(extractHashtags("Nothing tagged here.")).toEqual([]);
  });
});

describe("normalizeTagName", () => {
  it("lowercases and drops a leading #", () => {
    expect(normalizeTagName("#Method")).toBe("method");
    expect(normalizeTagName("  zettel/idea-2 ")).toBe("zettel/idea-2");
  });

  it("rejects names a #hashtag couldn't express", () => {
    for (const bad of ["", "#", "2fast", "two words", "tag!", "##x"]) {
      expect(normalizeTagName(bad), bad).toBeNull();
    }
  });
});

describe("hashtagLine", () => {
  it("writes each tag as a #hashtag that reads back as the same tags", () => {
    const line = hashtagLine(["method", "area/sub-topic"]);
    expect(line).toBe("#method #area/sub-topic");
    expect(extractHashtags(line)).toEqual(["method", "area/sub-topic"]);
  });

  it("leaves out the journal tag, which only a journal note's type grants", () => {
    expect(hashtagLine([JOURNAL_TAG, "method"])).toBe("#method");
  });

  it("is empty when there are no tags to carry over", () => {
    expect(hashtagLine([])).toBe("");
    expect(hashtagLine([JOURNAL_TAG])).toBe("");
  });
});

describe("typingSuggestion", () => {
  it("finds an open [[ link before the cursor", () => {
    expect(typingSuggestion("See [[Ato", 9)).toEqual({ kind: "link", query: "Ato", from: 6 });
    expect(typingSuggestion("See [[", 6)).toEqual({ kind: "link", query: "", from: 6 });
  });

  it("ignores a link that is already closed or has an alias", () => {
    expect(typingSuggestion("See [[Atomic]] and", 18)).toBeNull();
    expect(typingSuggestion("See [[Atomic|al", 15)).toBeNull();
  });

  it("finds a #hashtag being typed, but not a heading or a # inside a word", () => {
    expect(typingSuggestion("About #me", 9)).toEqual({ kind: "tag", query: "me", from: 7 });
    expect(typingSuggestion("About #", 7)).toEqual({ kind: "tag", query: "", from: 7 });
    expect(typingSuggestion("# Heading", 9)).toBeNull();
    expect(typingSuggestion("C#sharp", 7)).toBeNull();
    expect(typingSuggestion("## sub", 2)).toBeNull();
  });

  it("only looks at the text before the cursor", () => {
    expect(typingSuggestion("See [[Ato later", 9)).toEqual({ kind: "link", query: "Ato", from: 6 });
    expect(typingSuggestion("plain text", 5)).toBeNull();
  });
});

describe("applyTypingSuggestion", () => {
  it("completes a link, closes it, and puts the cursor after it", () => {
    const s = typingSuggestion("See [[Ato", 9)!;
    expect(applyTypingSuggestion("See [[Ato", 9, s, "Atomic Habits")).toEqual({ text: "See [[Atomic Habits]]", cursor: 21 });
  });

  it("reuses closing brackets that are already there", () => {
    const s = typingSuggestion("See [[Ato]] too", 9)!;
    expect(applyTypingSuggestion("See [[Ato]] too", 9, s, "Atomic Habits")).toEqual({ text: "See [[Atomic Habits]] too", cursor: 21 });
  });

  it("completes a tag in place", () => {
    const s = typingSuggestion("About #me and more", 9)!;
    expect(applyTypingSuggestion("About #me and more", 9, s, "method")).toEqual({ text: "About #method and more", cursor: 13 });
  });
});

describe("matchingSuggestions", () => {
  it("offers titles containing the query, whatever the case", () => {
    expect(matchingSuggestions({ kind: "link", query: "hab", from: 0 }, ["Atomic Habits", "Systems"], [])).toEqual(["Atomic Habits"]);
  });

  it("offers tags containing the query, but not the tag already typed in full", () => {
    expect(matchingSuggestions({ kind: "tag", query: "me", from: 0 }, [], ["method", "me", "habits"])).toEqual(["method"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Note ${i}`);
    expect(matchingSuggestions({ kind: "link", query: "", from: 0 }, many, [], 8)).toHaveLength(8);
  });
});

describe("typing suggestions: edge cases", () => {
  it("does not let an unclosed [[ on an earlier line swallow a #tag typed later", () => {
    expect(typingSuggestion("Intro [[draft\n\nLater #pro", 25)).toEqual({ kind: "tag", query: "pro", from: 22 });
  });

  it("starts the link query at the nearest [[", () => {
    expect(typingSuggestion("[[One]] and [[Tw", 16)).toEqual({ kind: "link", query: "Tw", from: 14 });
    expect(typingSuggestion("a [[b [[c", 9)).toEqual({ kind: "link", query: "c", from: 8 });
  });

  it("replaces the whole tag when the cursor is in the middle of one", () => {
    const s = typingSuggestion("About #mexyz end", 9)!;
    expect(applyTypingSuggestion("About #mexyz end", 9, s, "method")).toEqual({ text: "About #method end", cursor: 13 });
  });
});
