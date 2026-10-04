import { extractHashtags, extractWikiLinkTitles, noteTypeSchema } from "@simplekasten/core";
import { describe, expect, it } from "vitest";
import { SAMPLE_REVIEW_TITLES, SAMPLE_TEMPLATE, SAMPLE_VAULT } from "./sample-vault";

// The sample vault is referenced by title in two places that fail quietly
// when it drifts: the dev-vault seed (scripts/seed-dev-vault.js) queues
// notes for review by title, and a [[wiki-link]] to a renamed note just
// renders unresolved in the README demo GIF. These checks make that loud.

const titles = new Set(SAMPLE_VAULT.map((n) => n.title));

describe("sample vault", () => {
  it("has unique ids, zettelIds and titles", () => {
    expect(new Set(SAMPLE_VAULT.map((n) => n.id)).size).toBe(SAMPLE_VAULT.length);
    expect(new Set(SAMPLE_VAULT.map((n) => n.zettelId)).size).toBe(SAMPLE_VAULT.length);
    expect(titles.size).toBe(SAMPLE_VAULT.length);
  });

  it("gives every note a real note type", () => {
    for (const note of SAMPLE_VAULT) {
      expect(noteTypeSchema.safeParse(note.type).success, `${note.title}: ${note.type}`).toBe(true);
    }
  });

  it("covers every note type a user can pick, so badges and graph colours all show", () => {
    const authorable = noteTypeSchema.options.filter((t) => t !== "daily");
    expect([...new Set(SAMPLE_VAULT.map((n) => n.type))].sort()).toEqual([...authorable].sort());
  });

  it("resolves every [[wiki-link]] to a note in the set", () => {
    const unresolved: string[] = [];
    for (const note of SAMPLE_VAULT) {
      for (const target of extractWikiLinkTitles(note.content)) {
        if (!titles.has(target)) unresolved.push(`${note.title} -> [[${target}]]`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("links the Map of Content to notes that exist, in both directions", () => {
    const moc = SAMPLE_VAULT.find((n) => n.type === "structure");
    expect(moc, "a structure note is what makes Maps of Content visible").toBeDefined();
    expect(extractWikiLinkTitles(moc!.content).length).toBeGreaterThan(1);

    // Something has to link back, or the Linked mentions panel stays empty.
    const linkers = SAMPLE_VAULT.filter((n) => extractWikiLinkTitles(n.content).length > 0);
    expect(linkers.length).toBeGreaterThan(1);
  });

  it("carries more than one #hashtag group, so the tag filter has something to do", () => {
    const tags = new Set(SAMPLE_VAULT.flatMap((n) => extractHashtags(n.content)));
    expect(tags.size).toBeGreaterThan(1);
  });

  it("names review-queue notes that actually exist", () => {
    expect(SAMPLE_REVIEW_TITLES.length).toBeGreaterThan(0);
    for (const title of SAMPLE_REVIEW_TITLES) {
      expect(titles.has(title), `no sample note titled "${title}"`).toBe(true);
    }
  });

  it("gives the seeded template the tokens the engine expands", () => {
    expect(SAMPLE_TEMPLATE.content).toContain("{{title}}");
    expect(SAMPLE_TEMPLATE.name.length).toBeGreaterThan(0);
  });
});
