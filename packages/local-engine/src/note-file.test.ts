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
      attachmentIds: [],
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
      attachmentIds: [],
    };

    const parsed = parseNoteFile(serializeNoteFile(note), note.id);
    expect(parsed.deletedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("round-trips attachmentIds, omitting the field entirely when empty", () => {
    const withAttachments: VaultNote = {
      id: "att1",
      zettelId: "3",
      title: "With photo",
      type: "fleeting",
      content: "body",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      attachmentIds: ["a1", "a2"],
    };

    const raw = serializeNoteFile(withAttachments);
    expect(raw).toContain("attachmentIds");
    expect(parseNoteFile(raw, withAttachments.id)).toEqual(withAttachments);

    const withoutAttachments: VaultNote = { ...withAttachments, id: "att2", attachmentIds: [] };
    const rawEmpty = serializeNoteFile(withoutAttachments);
    expect(rawEmpty).not.toContain("attachmentIds");
    expect(parseNoteFile(rawEmpty, withoutAttachments.id)).toEqual(withoutAttachments);
  });

  it("throws when a file has no frontmatter block", () => {
    expect(() => parseNoteFile("just plain markdown, no frontmatter", "id1")).toThrow();
  });
});
