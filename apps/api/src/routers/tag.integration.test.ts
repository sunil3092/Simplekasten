import { describe, expect, it } from "vitest";
import { registerUser } from "../test-helpers";

describe("tag.list", () => {
  it("returns an empty list for a vault with no tagged notes", async () => {
    const { caller, kb } = await registerUser("tag-empty");
    expect(await caller.tag.list({ kbId: kb.id })).toEqual([]);
  });

  it("sorts tags alphabetically", async () => {
    const { caller, kb } = await registerUser("tag-sort");
    await caller.note.create({ kbId: kb.id, title: "N", content: "#zebra #apple #mango", type: "fleeting" });
    const tags = await caller.tag.list({ kbId: kb.id });
    expect(tags.map((t) => t.name)).toEqual(["apple", "mango", "zebra"]);
  });

  it("rejects listing tags for a vault the caller doesn't own", async () => {
    const alice = await registerUser("tag-owns-a");
    const bob = await registerUser("tag-owns-b");
    await expect(bob.caller.tag.list({ kbId: alice.kb.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
