import { describe, expect, it } from "vitest";
import { parseHistorySnapshot, serializeHistorySnapshot } from "./history-file";

describe("history-file frontmatter round-trip", () => {
  it("serializes then parses back to the same snapshot", () => {
    const snapshot = { title: "Atomicity", content: "Notes should be atomic. See [[Zettelkasten]].", createdAt: "2026-09-25T00:00:00.000Z" };
    expect(parseHistorySnapshot(serializeHistorySnapshot(snapshot))).toEqual(snapshot);
  });

  it("round-trips multi-line content", () => {
    const snapshot = { title: "Journal", content: "Line one.\nLine two.\n\nLine four.", createdAt: "2026-09-25T00:00:00.000Z" };
    expect(parseHistorySnapshot(serializeHistorySnapshot(snapshot))).toEqual(snapshot);
  });

  it("round-trips empty content", () => {
    const snapshot = { title: "Blank", content: "", createdAt: "2026-09-25T00:00:00.000Z" };
    expect(parseHistorySnapshot(serializeHistorySnapshot(snapshot))).toEqual(snapshot);
  });

  it("throws when a file has no frontmatter block", () => {
    expect(() => parseHistorySnapshot("just plain markdown, no frontmatter")).toThrow();
  });
});
