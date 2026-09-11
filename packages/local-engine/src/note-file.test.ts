import { describe, expect, it } from "vitest";
import { parseNoteFile, serializeNoteFile } from "./note-file";
import type { VaultNote } from "./types";

describe("note-file frontmatter round-trip", () => {
  it("serializes then parses back to the same note", () => {
    const note: VaultNote = {
      id: "abc123",
      zettelId: "1",
      title: "Atomicity",
      type: "permanent",
      content: "Notes should be atomic. See [[Zettelkasten]]. #method",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      deletedAt: null,
    };

    const raw = serializeNoteFile(note);
    const parsed = parseNoteFile(raw, note.id);

    expect(parsed).toEqual(note);
  });

  it("round-trips a soft-deleted note's deletedAt", () => {
    const note: VaultNote = {
      id: "xyz",
      zettelId: "2",
      title: "Gone",
      type: "fleeting",
      content: "body",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: "2026-01-03T00:00:00.000Z",
    };

    const parsed = parseNoteFile(serializeNoteFile(note), note.id);
    expect(parsed.deletedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("throws when a file has no frontmatter block", () => {
    expect(() => parseNoteFile("just plain markdown, no frontmatter", "id1")).toThrow();
  });
});
