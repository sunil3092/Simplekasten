import { describe, expect, it } from "vitest";
import { registerUser } from "../test-helpers";

describe("note.create / list / getById", () => {
  it("assigns sequential zettel IDs within a vault, starting at 1", async () => {
    const { caller, kb } = await registerUser("zettel");
    const first = await caller.note.create({ kbId: kb.id, title: "First", content: "", type: "fleeting" });
    const second = await caller.note.create({ kbId: kb.id, title: "Second", content: "", type: "fleeting" });
    expect(first.zettelId).toBe("1");
    expect(second.zettelId).toBe("2");
  });

  it("lists notes newest-updated first", async () => {
    const { caller, kb } = await registerUser("list-order");
    const a = await caller.note.create({ kbId: kb.id, title: "A", content: "", type: "fleeting" });
    await caller.note.create({ kbId: kb.id, title: "B", content: "", type: "fleeting" });
    await caller.note.update({ id: a.id, title: "A (edited)" });

    const list = await caller.note.list({ kbId: kb.id });
    expect(list[0].title).toBe("A (edited)");
  });

  it("rejects creating a note in a vault the caller doesn't own", async () => {
    const alice = await registerUser("owns-a");
    const bob = await registerUser("owns-b");
    await expect(
      bob.caller.note.create({ kbId: alice.kb.id, title: "Intruding note", content: "", type: "fleeting" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides another user's note behind NOT_FOUND rather than leaking it", async () => {
    const alice = await registerUser("hide-a");
    const bob = await registerUser("hide-b");
    const note = await alice.caller.note.create({ kbId: alice.kb.id, title: "Private", content: "", type: "fleeting" });
    await expect(bob.caller.note.getById({ id: note.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("note.update", () => {
  it("supports a partial update that only changes the type", async () => {
    const { caller, kb } = await registerUser("partial-update");
    const note = await caller.note.create({ kbId: kb.id, title: "T", content: "body", type: "fleeting" });
    const updated = await caller.note.update({ id: note.id, type: "permanent" });
    expect(updated.type).toBe("permanent");
    expect(updated.content).toBe("body");
  });
});

describe("note.delete", () => {
  it("soft-deletes: the note disappears from list and getById", async () => {
    const { caller, kb } = await registerUser("delete");
    const note = await caller.note.create({ kbId: kb.id, title: "Gone soon", content: "", type: "fleeting" });
    await caller.note.delete({ id: note.id });

    const list = await caller.note.list({ kbId: kb.id });
    expect(list.some((n) => n.id === note.id)).toBe(false);
    await expect(caller.note.getById({ id: note.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("[[wiki-link]] resolution", () => {
  it("stores a link to a not-yet-existing note as unresolved", async () => {
    const { caller, kb } = await registerUser("link-unresolved");
    const source = await caller.note.create({
      kbId: kb.id,
      title: "On writing systems",
      content: "See [[Atomicity]] for why one idea per note.",
      type: "fleeting",
    });
    const detail = await caller.note.getById({ id: source.id });
    expect(detail.outboundLinks).toHaveLength(1);
    expect(detail.outboundLinks[0]).toMatchObject({ targetTitle: "Atomicity", resolved: false, targetNoteId: null });
  });

  it("resolves the pending link the moment the target note is created, and shows it as a backlink", async () => {
    const { caller, kb } = await registerUser("link-resolve");
    const source = await caller.note.create({
      kbId: kb.id,
      title: "On writing systems",
      content: "See [[Atomicity]] for why one idea per note.",
      type: "fleeting",
    });
    const target = await caller.note.create({
      kbId: kb.id,
      title: "Atomicity",
      content: "One idea per note, in your own words.",
      type: "permanent",
    });

    const targetDetail = await caller.note.getById({ id: target.id });
    expect(targetDetail.backlinks).toHaveLength(1);
    expect(targetDetail.backlinks[0]).toMatchObject({ noteId: source.id, title: "On writing systems" });

    const sourceDetail = await caller.note.getById({ id: source.id });
    expect(sourceDetail.outboundLinks[0]).toMatchObject({ resolved: true, targetNoteId: target.id });
  });

  it("re-derives links from scratch when a note's content is edited", async () => {
    const { caller, kb } = await registerUser("link-edit");
    const source = await caller.note.create({ kbId: kb.id, title: "Source", content: "[[First]]", type: "fleeting" });
    await caller.note.update({ id: source.id, content: "now linking to [[Second]] instead" });

    const detail = await caller.note.getById({ id: source.id });
    expect(detail.outboundLinks).toHaveLength(1);
    expect(detail.outboundLinks[0].targetTitle).toBe("Second");
  });

  it("matches link targets case-insensitively", async () => {
    const { caller, kb } = await registerUser("link-case");
    const target = await caller.note.create({ kbId: kb.id, title: "Atomicity", content: "", type: "permanent" });
    const source = await caller.note.create({
      kbId: kb.id,
      title: "Source",
      content: "See [[ATOMICITY]] and [[atomicity]].",
      type: "fleeting",
    });
    const detail = await caller.note.getById({ id: source.id });
    expect(detail.outboundLinks.every((l) => l.targetNoteId === target.id)).toBe(true);
  });
});

describe("#hashtag parsing", () => {
  it("creates tags from hashtags in content and lets note.list filter by tag", async () => {
    const { caller, kb } = await registerUser("tags-create");
    await caller.note.create({ kbId: kb.id, title: "N1", content: "about #evolution and #biology", type: "fleeting" });
    await caller.note.create({ kbId: kb.id, title: "N2", content: "also #evolution here", type: "fleeting" });
    await caller.note.create({ kbId: kb.id, title: "N3", content: "unrelated, no tags", type: "fleeting" });

    const evolutionNotes = await caller.note.list({ kbId: kb.id, tag: "evolution" });
    expect(evolutionNotes.map((n) => n.title).sort()).toEqual(["N1", "N2"]);

    const tags = await caller.tag.list({ kbId: kb.id });
    const byName = Object.fromEntries(tags.map((t) => [t.name, t.noteCount]));
    expect(byName).toMatchObject({ evolution: 2, biology: 1 });
  });

  it("does not treat a markdown heading as a tag", async () => {
    const { caller, kb } = await registerUser("tags-heading");
    await caller.note.create({ kbId: kb.id, title: "N1", content: "# Heading one\nno real tags here", type: "fleeting" });
    const tags = await caller.tag.list({ kbId: kb.id });
    expect(tags).toHaveLength(0);
  });

  it("removes a tag association when the hashtag is edited out", async () => {
    const { caller, kb } = await registerUser("tags-remove");
    const note = await caller.note.create({ kbId: kb.id, title: "N1", content: "#temporary", type: "fleeting" });
    await caller.note.update({ id: note.id, content: "no longer tagged" });

    const filtered = await caller.note.list({ kbId: kb.id, tag: "temporary" });
    expect(filtered).toHaveLength(0);
  });
});

describe("note.search", () => {
  it("finds a note by a word that only appears in its body, not its title", async () => {
    const { caller, kb } = await registerUser("search-body");
    await caller.note.create({
      kbId: kb.id,
      title: "Finch beaks",
      content: "Galapagos finches show rapid beak-shape shifts under drought.",
      type: "literature",
    });
    const results = await caller.note.search({ kbId: kb.id, query: "drought" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Finch beaks");
    expect(results[0].snippet).toContain("drought");
  });

  it("ranks a title match above a body-only match", async () => {
    const { caller, kb } = await registerUser("search-rank");
    await caller.note.create({ kbId: kb.id, title: "Something else", content: "mentions evolution in passing", type: "fleeting" });
    await caller.note.create({ kbId: kb.id, title: "Evolution", content: "the main subject", type: "permanent" });

    const results = await caller.note.search({ kbId: kb.id, query: "evolution" });
    expect(results[0].title).toBe("Evolution");
  });

  it("returns nothing for a query that matches no note", async () => {
    const { caller, kb } = await registerUser("search-empty");
    await caller.note.create({ kbId: kb.id, title: "Unrelated", content: "nothing to do with it", type: "fleeting" });
    const results = await caller.note.search({ kbId: kb.id, query: "xenobiology" });
    expect(results).toHaveLength(0);
  });
});

describe("note.graph", () => {
  it("includes every note as a node, even ones with no links", async () => {
    const { caller, kb } = await registerUser("graph-nodes");
    await caller.note.create({ kbId: kb.id, title: "Lonely note", content: "no links here", type: "fleeting" });
    const graph = await caller.note.graph({ kbId: kb.id });
    expect(graph.nodes.map((n) => n.title)).toEqual(["Lonely note"]);
    expect(graph.edges).toHaveLength(0);
  });

  it("adds an edge for a resolved link but not for an unresolved one", async () => {
    const { caller, kb } = await registerUser("graph-edges");
    const target = await caller.note.create({ kbId: kb.id, title: "Target", content: "", type: "fleeting" });
    const source = await caller.note.create({
      kbId: kb.id,
      title: "Source",
      content: "see [[Target]] and also [[Nonexistent]]",
      type: "fleeting",
    });

    const graph = await caller.note.graph({ kbId: kb.id });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([{ source: source.id, target: target.id }]);
  });

  it("rejects reading the graph of a vault the caller doesn't own", async () => {
    const alice = await registerUser("graph-owns-a");
    const bob = await registerUser("graph-owns-b");
    await expect(bob.caller.note.graph({ kbId: alice.kb.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
