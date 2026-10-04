import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("returns no diff for identical text", () => {
    expect(diffLines("a\nb\nc", "a\nb\nc")).toEqual([
      { op: "equal", text: "a" },
      { op: "equal", text: "b" },
      { op: "equal", text: "c" },
    ]);
  });

  it("marks a purely inserted line", () => {
    expect(diffLines("a\nb", "a\nx\nb")).toEqual([
      { op: "equal", text: "a" },
      { op: "insert", text: "x" },
      { op: "equal", text: "b" },
    ]);
  });

  it("marks a purely deleted line", () => {
    expect(diffLines("a\nb\nc", "a\nc")).toEqual([
      { op: "equal", text: "a" },
      { op: "delete", text: "b" },
      { op: "equal", text: "c" },
    ]);
  });

  it("marks a replaced line as a delete followed by an insert", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc")).toEqual([
      { op: "equal", text: "a" },
      { op: "delete", text: "b" },
      { op: "insert", text: "x" },
      { op: "equal", text: "c" },
    ]);
  });

  it("returns an empty diff for two empty strings", () => {
    expect(diffLines("", "")).toEqual([]);
  });

  it("treats a wholly new non-empty text as one big insert", () => {
    expect(diffLines("", "hello")).toEqual([{ op: "insert", text: "hello" }]);
  });

  it("treats emptying a note as one big delete", () => {
    expect(diffLines("hello", "")).toEqual([{ op: "delete", text: "hello" }]);
  });
});
