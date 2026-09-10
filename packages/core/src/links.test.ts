import { describe, expect, it } from "vitest";
import { extractHashtags, extractWikiLinkTitles } from "./links";

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
