import { describe, expect, it } from "vitest";
import { tagPickerState, toggleAssignedTag } from "./tags";

const vaultTags = [
  { name: "method", noteCount: 3 },
  { name: "devs", noteCount: 5 },
  { name: "zettel", noteCount: 1 },
];

describe("tagPickerState", () => {
  it("lists the note's tags first, locking ones that only come from #hashtags", () => {
    const { rows } = tagPickerState({ vaultTags, assigned: ["zettel"], onNote: ["method", "zettel"], query: "" });
    expect(rows.map((r) => [r.name, r.checked, r.locked])).toEqual([
      ["method", true, true],
      ["zettel", true, false],
      ["devs", false, false],
    ]);
  });

  it("an assigned tag that is also a #hashtag can still be unassigned", () => {
    const { rows } = tagPickerState({ vaultTags, assigned: ["method"], onNote: ["method"], query: "" });
    expect(rows.find((r) => r.name === "method")?.locked).toBe(false);
  });

  it("filters by query and offers to create a new valid name", () => {
    expect(tagPickerState({ vaultTags, assigned: [], onNote: [], query: "#Me" })).toEqual({
      rows: [{ name: "method", noteCount: 3, checked: false, locked: false }],
      create: "me",
      invalid: false,
    });
    expect(tagPickerState({ vaultTags, assigned: [], onNote: [], query: "method" }).create).toBeNull();
  });

  it("flags a query that can't be a tag", () => {
    const state = tagPickerState({ vaultTags, assigned: [], onNote: [], query: "two words" });
    expect(state.invalid).toBe(true);
    expect(state.create).toBeNull();
  });
});

describe("toggleAssignedTag", () => {
  it("adds (sorted) and removes", () => {
    expect(toggleAssignedTag(["b"], "a")).toEqual(["a", "b"]);
    expect(toggleAssignedTag(["a", "b"], "a")).toEqual(["b"]);
  });
});
