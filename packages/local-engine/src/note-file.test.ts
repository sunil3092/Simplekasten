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
      noteDate: null,
      reviewDue: null,
      reviewEase: 2.5,
      reviewInterval: 0,
      reviewReps: 0,
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
      noteDate: null,
      reviewDue: null,
      reviewEase: 2.5,
      reviewInterval: 0,
      reviewReps: 0,
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
      noteDate: null,
      reviewDue: null,
      reviewEase: 2.5,
      reviewInterval: 0,
      reviewReps: 0,
    };

    const raw = serializeNoteFile(withAttachments);
    expect(raw).toContain("attachmentIds");
    expect(parseNoteFile(raw, withAttachments.id)).toEqual(withAttachments);

    const withoutAttachments: VaultNote = { ...withAttachments, id: "att2", attachmentIds: [] };
    const rawEmpty = serializeNoteFile(withoutAttachments);
    expect(rawEmpty).not.toContain("attachmentIds");
    expect(parseNoteFile(rawEmpty, withoutAttachments.id)).toEqual(withoutAttachments);
  });

  it("round-trips a daily note's noteDate, omitting the field entirely for ordinary notes", () => {
    const daily: VaultNote = {
      id: "day1",
      zettelId: "4",
      title: "September 22, 2026",
      type: "daily",
      content: "",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
      deletedAt: null,
      attachmentIds: [],
      noteDate: "2026-09-22",
      reviewDue: null,
      reviewEase: 2.5,
      reviewInterval: 0,
      reviewReps: 0,
    };

    const raw = serializeNoteFile(daily);
    expect(raw).toContain("noteDate");
    expect(parseNoteFile(raw, daily.id)).toEqual(daily);

    const ordinary: VaultNote = { ...daily, id: "day2", type: "fleeting", noteDate: null };
    const rawOrdinary = serializeNoteFile(ordinary);
    expect(rawOrdinary).not.toContain("noteDate");
    expect(parseNoteFile(rawOrdinary, ordinary.id)).toEqual(ordinary);
  });

  it("round-trips review-queue fields as a group, omitting all four when not in the queue", () => {
    const inQueue: VaultNote = {
      id: "rev1",
      zettelId: "5",
      title: "Atomicity",
      type: "permanent",
      content: "body",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      attachmentIds: [],
      noteDate: null,
      reviewDue: "2026-09-30",
      reviewEase: 2.65,
      reviewInterval: 6,
      reviewReps: 2,
    };

    const raw = serializeNoteFile(inQueue);
    expect(raw).toContain("reviewDue");
    expect(parseNoteFile(raw, inQueue.id)).toEqual(inQueue);

    const notInQueue: VaultNote = { ...inQueue, id: "rev2", reviewDue: null };
    const rawNotInQueue = serializeNoteFile(notInQueue);
    expect(rawNotInQueue).not.toContain("reviewDue");
    expect(rawNotInQueue).not.toContain("reviewEase");
    expect(rawNotInQueue).not.toContain("reviewInterval");
    expect(rawNotInQueue).not.toContain("reviewReps");
    // Parsing back a file with no review fields at all falls back to the
    // "never reviewed" defaults, not whatever notInQueue happened to carry.
    expect(parseNoteFile(rawNotInQueue, notInQueue.id)).toEqual({
      ...notInQueue,
      reviewEase: 2.5,
      reviewInterval: 0,
      reviewReps: 0,
    });
  });

  it("throws when a file has no frontmatter block", () => {
    expect(() => parseNoteFile("just plain markdown, no frontmatter", "id1")).toThrow();
  });
});
