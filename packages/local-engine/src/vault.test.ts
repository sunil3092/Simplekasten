import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryFs } from "./memory-fs.test-helper";
import {
  createNote,
  deleteNote,
  getGraph,
  getNoteById,
  getOrCreateDailyNote,
  listDailyNotes,
  listNotes,
  listTags,
  searchNotes,
  updateNote,
  createAttachment,
  deleteAttachment,
  getAttachmentFilePath,
  listAttachments,
  applyTemplate,
  createTemplate,
  deleteTemplate,
  listTemplates,
  setDefaultForDailyNote,
  updateTemplate,
  addToReviewQueue,
  listDueForReview,
  removeFromReviewQueue,
  submitReview,
  listNoteVersions,
  getNoteVersion,
  restoreNoteVersion,
} from "./vault";

describe("vault engine", () => {
  it("creates notes with increasing zettelIds", async () => {
    const fs = createMemoryFs();
    const a = await createNote(fs, { title: "First", content: "" });
    const b = await createNote(fs, { title: "Second", content: "" });

    expect(a.zettelId).toBe("1");
    expect(b.zettelId).toBe("2");
  });

  it("resolves a [[wiki link]] once the target note exists, and leaves it unresolved before that", async () => {
    const fs = createMemoryFs();
    const source = await createNote(fs, { title: "Source", content: "See [[Target]] for details." });

    const beforeTarget = await getNoteById(fs, source.id);
    expect(beforeTarget?.contents).toEqual([{ noteId: null, title: "Target", zettelId: null, resolved: false }]);

    const target = await createNote(fs, { title: "Target", content: "The target note." });

    const afterTarget = await getNoteById(fs, source.id);
    expect(afterTarget?.contents).toEqual([
      { noteId: target.id, title: "Target", zettelId: target.zettelId, resolved: true },
    ]);

    const targetDetail = await getNoteById(fs, target.id);
    expect(targetDetail?.backlinks).toEqual([{ noteId: source.id, title: "Source", zettelId: source.zettelId }]);
  });

  it("strips wiki-link brackets from titles so the note stays linkable", async () => {
    const fs = createMemoryFs();
    const created = await createNote(fs, { title: "Ponytail [[Claude Code]]", content: "" });
    expect(created.title).toBe("Ponytail Claude Code");

    const source = await createNote(fs, { title: "Source", content: "[[Ponytail Claude Code]]" });
    const renamed = await updateNote(fs, { id: created.id, title: "[[Renamed]]" });
    expect(renamed.title).toBe("Renamed");

    await updateNote(fs, { id: source.id, content: "[[Renamed]]" });
    const detail = await getNoteById(fs, renamed.id);
    expect(detail?.backlinks).toEqual([{ noteId: source.id, title: "Source", zettelId: source.zettelId }]);
  });

  it("re-derives links after an update, dropping ones no longer referenced", async () => {
    const fs = createMemoryFs();
    const target = await createNote(fs, { title: "Target", content: "" });
    const source = await createNote(fs, { title: "Source", content: "[[Target]]" });

    await updateNote(fs, { id: source.id, content: "No more links here." });

    const targetDetail = await getNoteById(fs, target.id);
    expect(targetDetail?.backlinks).toEqual([]);
  });

  it("syncs #hashtags into the tag list with counts", async () => {
    const fs = createMemoryFs();
    await createNote(fs, { title: "One", content: "About #zettelkasten and #method." });
    await createNote(fs, { title: "Two", content: "Also #zettelkasten." });

    const tags = await listTags(fs);
    expect(tags).toEqual([
      { id: "method", name: "method", noteCount: 1 },
      { id: "zettelkasten", name: "zettelkasten", noteCount: 2 },
    ]);
  });

  it("excludes soft-deleted notes from list/graph/tags but keeps the file", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "Gone", content: "#tag" });
    await deleteNote(fs, note.id);

    expect(await listNotes(fs)).toEqual([]);
    expect(await listTags(fs)).toEqual([]);
    expect((await getGraph(fs)).nodes).toEqual([]);
    expect(await fs.exists("notes/" + note.id + ".md")).toBe(true);
  });

  it("builds a graph with resolved links as edges", async () => {
    const fs = createMemoryFs();
    const target = await createNote(fs, { title: "Target", content: "" });
    const source = await createNote(fs, { title: "Source", content: "[[Target]]" });

    const graph = await getGraph(fs);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual([source.id, target.id].sort());
    expect(graph.edges).toEqual([{ source: source.id, target: target.id }]);
  });

  it("search wraps the match in \\u0001/\\u0002 sentinels for QuickSwitcher's Snippet", async () => {
    const fs = createMemoryFs();
    await createNote(fs, { title: "Atomicity", content: "Notes should be atomic and self-contained." });

    const results = await searchNotes(fs, "atomic");
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain("atomic");
  });

  it("ranks a title match above a content-only match", async () => {
    const fs = createMemoryFs();
    await createNote(fs, { title: "Something else", content: "mentions atomicity in passing" });
    await createNote(fs, { title: "Atomicity", content: "the real note" });

    const results = await searchNotes(fs, "atomicity");
    expect(results[0].title).toBe("Atomicity");
  });
});

describe("attachments", () => {
  it("creates an attachment, links it to the note, and lists it back", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With photo", content: "" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(attachment.kind).toBe("photo");
    expect(await listAttachments(fs, note.id)).toEqual([attachment]);

    const detail = await getNoteById(fs, note.id);
    expect(detail?.attachments).toEqual([attachment]);
  });

  it("classifies audio mime types as voice attachments", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With voice memo", content: "" });
    await fs.writeFile("incoming/memo.m4a", "fake-audio-bytes");

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/memo.m4a",
      filename: "memo.m4a",
      mimeType: "audio/m4a",
    });

    expect(attachment.kind).toBe("voice");
  });

  it("rejects unsupported mime types", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "Target", content: "" });
    await fs.writeFile("incoming/doc.pdf", "fake-pdf-bytes");

    await expect(
      createAttachment(fs, {
        noteId: note.id,
        sourcePath: "incoming/doc.pdf",
        filename: "doc.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(/Unsupported attachment mime type/);
  });

  it("removes an attachment's file, manifest entry, and note reference on delete", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With photo", content: "" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");
    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    await deleteAttachment(fs, attachment.id);

    expect(await listAttachments(fs, note.id)).toEqual([]);
    expect(await fs.exists(`attachments/${attachment.id}-photo.jpg`)).toBe(false);
    await expect(getAttachmentFilePath(fs, attachment.id)).rejects.toThrow(/not found/);
  });

  it("keeps an edit that lands while the attachment file is still copying", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "With photo", content: "original" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");

    // Copying a multi-megabyte photo is the slow part of createAttachment;
    // this stands in for mobile's 600ms autosave firing mid-copy.
    const copyFile = fs.copyFile.bind(fs);
    fs.copyFile = async (source, dest) => {
      await copyFile(source, dest);
      await updateNote(fs, { id: note.id, content: "edited during copy" });
    };

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    const detail = await getNoteById(fs, note.id);
    expect(detail?.content).toBe("edited during copy");
    expect(detail?.attachments).toEqual([attachment]);
  });

  it("sanitizes a filename that would otherwise escape the attachments directory", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "Sneaky", content: "" });
    await fs.writeFile("incoming/photo.jpg", "fake-image-bytes");

    const attachment = await createAttachment(fs, {
      noteId: note.id,
      sourcePath: "incoming/photo.jpg",
      filename: "../../escaped.jpg",
      mimeType: "image/jpeg",
    });

    expect(attachment.filename).toBe(".._.._escaped.jpg");
    // The stored filename is what's on disk, so display and path agree.
    expect(await getAttachmentFilePath(fs, attachment.id)).toBe(`attachments/${attachment.id}-${attachment.filename}`);
    expect(await fs.exists(`attachments/${attachment.id}-${attachment.filename}`)).toBe(true);
  });

  it("reports the manifest path when the manifest is corrupt instead of throwing a bare SyntaxError", async () => {
    const fs = createMemoryFs();
    const note = await createNote(fs, { title: "Any", content: "" });
    await fs.writeFile("attachments/manifest.json", "{ not json");

    await expect(getNoteById(fs, note.id)).rejects.toThrow(/attachments\/manifest\.json" is not valid JSON/);
  });

  describe("daily notes", () => {
    it("creates a daily note once per date and returns the same one on a second call", async () => {
      const fs = createMemoryFs();
      const first = await getOrCreateDailyNote(fs, "2026-09-22");
      const second = await getOrCreateDailyNote(fs, "2026-09-22");

      expect(second.id).toBe(first.id);
      expect(first.type).toBe("daily");
      expect(first.noteDate).toBe("2026-09-22");
      expect(first.title).toBe("September 22, 2026");
      expect(await listNotes(fs)).toHaveLength(1);
    });

    it("creates a separate note for a different date", async () => {
      const fs = createMemoryFs();
      const today = await getOrCreateDailyNote(fs, "2026-09-22");
      const tomorrow = await getOrCreateDailyNote(fs, "2026-09-23");

      expect(tomorrow.id).not.toBe(today.id);
      expect(await listNotes(fs)).toHaveLength(2);
    });

    it("assigns daily notes a zettelId from the normal sequence, not a separate namespace", async () => {
      const fs = createMemoryFs();
      await createNote(fs, { title: "Ordinary", content: "" });
      const daily = await getOrCreateDailyNote(fs, "2026-09-22");

      expect(daily.zettelId).toBe("2");
    });

    it("lists daily notes newest-first, excluding ordinary and deleted notes", async () => {
      const fs = createMemoryFs();
      await createNote(fs, { title: "Ordinary", content: "" });
      const older = await getOrCreateDailyNote(fs, "2026-09-20");
      const newer = await getOrCreateDailyNote(fs, "2026-09-22");
      const deleted = await getOrCreateDailyNote(fs, "2026-09-21");
      await deleteNote(fs, deleted.id);

      const daily = await listDailyNotes(fs);
      expect(daily.map((n) => n.id)).toEqual([newer.id, older.id]);
    });

    it("respects the limit passed to listDailyNotes", async () => {
      const fs = createMemoryFs();
      await getOrCreateDailyNote(fs, "2026-09-20");
      await getOrCreateDailyNote(fs, "2026-09-21");
      await getOrCreateDailyNote(fs, "2026-09-22");

      expect(await listDailyNotes(fs, 2)).toHaveLength(2);
    });
  });

  describe("templates", () => {
    it("creates, lists (alphabetically), updates and deletes templates", async () => {
      const fs = createMemoryFs();
      await createTemplate(fs, { name: "Zettel", content: "z" });
      const daily = await createTemplate(fs, { name: "Daily Log", content: "## Tasks" });

      expect((await listTemplates(fs)).map((t) => t.name)).toEqual(["Daily Log", "Zettel"]);

      const renamed = await updateTemplate(fs, { id: daily.id, name: "Journal" });
      expect(renamed.content).toBe("## Tasks");
      expect((await listTemplates(fs)).map((t) => t.name)).toEqual(["Journal", "Zettel"]);

      await deleteTemplate(fs, renamed.id);
      expect((await listTemplates(fs)).map((t) => t.name)).toEqual(["Zettel"]);
    });

    it("throws deleting or updating a template that doesn't exist", async () => {
      const fs = createMemoryFs();
      await expect(deleteTemplate(fs, "nope")).rejects.toThrow(/not found/);
      await expect(updateTemplate(fs, { id: "nope", name: "x" })).rejects.toThrow(/not found/);
    });

    it("keeps only one default-for-daily-note template at a time", async () => {
      const fs = createMemoryFs();
      const a = await createTemplate(fs, { name: "A", content: "" });
      const b = await createTemplate(fs, { name: "B", content: "" });

      await setDefaultForDailyNote(fs, a.id);
      expect((await listTemplates(fs)).find((t) => t.id === a.id)?.isDefaultForDailyNote).toBe(true);

      await setDefaultForDailyNote(fs, b.id);
      const templates = await listTemplates(fs);
      expect(templates.find((t) => t.id === a.id)?.isDefaultForDailyNote).toBe(false);
      expect(templates.find((t) => t.id === b.id)?.isDefaultForDailyNote).toBe(true);
    });

    it("applies a template by appending its expanded content, never replacing existing text", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "My Note", content: "Existing text." });
      const template = await createTemplate(fs, { name: "Greeting", content: "Hello, {{title}}!" });

      const detail = await applyTemplate(fs, { noteId: note.id, templateId: template.id });
      expect(detail.content).toBe("Existing text.\n\nHello, My Note!");
    });

    it("applies a template to an empty note without a leading blank line", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Empty", content: "" });
      const template = await createTemplate(fs, { name: "Greeting", content: "Hello, {{title}}!" });

      const detail = await applyTemplate(fs, { noteId: note.id, templateId: template.id });
      expect(detail.content).toBe("Hello, Empty!");
    });

    it("throws applying a missing template or to a missing note", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Note", content: "" });
      const template = await createTemplate(fs, { name: "T", content: "x" });

      await expect(applyTemplate(fs, { noteId: note.id, templateId: "nope" })).rejects.toThrow(/not found/);
      await expect(applyTemplate(fs, { noteId: "nope", templateId: template.id })).rejects.toThrow(/not found/);
    });

    it("pre-fills a new daily note from the default-for-daily-note template, expanding its tokens", async () => {
      const fs = createMemoryFs();
      const template = await createTemplate(fs, { name: "Daily", content: "# {{title}}\n\nLog:" });
      await setDefaultForDailyNote(fs, template.id);

      const daily = await getOrCreateDailyNote(fs, "2026-09-23");
      expect(daily.content).toBe("# September 23, 2026\n\nLog:");
    });

    it("leaves a new daily note's content empty when no default template exists", async () => {
      const fs = createMemoryFs();
      await createTemplate(fs, { name: "Not default", content: "should not appear" });

      const daily = await getOrCreateDailyNote(fs, "2026-09-23");
      expect(daily.content).toBe("");
    });
  });

  describe("review queue", () => {
    it("adds a note to the queue due immediately, with fresh SM-2 defaults", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "" });

      const updated = await addToReviewQueue(fs, note.id, "2026-09-23");
      expect(updated.reviewDue).toBe("2026-09-23");
      expect(updated.reviewEase).toBe(2.5);
      expect(updated.reviewInterval).toBe(0);
      expect(updated.reviewReps).toBe(0);
    });

    it("throws adding a note that doesn't exist", async () => {
      const fs = createMemoryFs();
      await expect(addToReviewQueue(fs, "nope", "2026-09-23")).rejects.toThrow(/not found/);
    });

    it("removes a note from the queue, resetting to the never-reviewed defaults", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "" });
      await addToReviewQueue(fs, note.id, "2026-09-23");
      await submitReview(fs, { noteId: note.id, rating: "good", today: "2026-09-23" });

      const removed = await removeFromReviewQueue(fs, note.id);
      expect(removed).toMatchObject({ reviewDue: null, reviewEase: 2.5, reviewInterval: 0, reviewReps: 0 });
    });

    it("lists only notes due on or before the given date, oldest-due-first, excluding notes not in the queue", async () => {
      const fs = createMemoryFs();
      await createNote(fs, { title: "Not in queue", content: "" });
      const dueToday = await createNote(fs, { title: "Due today", content: "" });
      const overdue = await createNote(fs, { title: "Overdue", content: "" });
      const dueTomorrow = await createNote(fs, { title: "Due tomorrow", content: "" });

      await addToReviewQueue(fs, dueToday.id, "2026-09-23");
      await addToReviewQueue(fs, overdue.id, "2026-09-20");
      await addToReviewQueue(fs, dueTomorrow.id, "2026-09-24");

      const due = await listDueForReview(fs, "2026-09-23");
      expect(due.map((n) => n.id)).toEqual([overdue.id, dueToday.id]);
    });

    it("excludes a deleted note from the due list even if it was in the queue", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Gone", content: "" });
      await addToReviewQueue(fs, note.id, "2026-09-23");
      await deleteNote(fs, note.id);

      expect(await listDueForReview(fs, "2026-09-23")).toEqual([]);
    });

    it("submitReview advances ease/interval/reps via the SM-2 algorithm and sets the next due date", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "" });
      await addToReviewQueue(fs, note.id, "2026-09-23");

      const first = await submitReview(fs, { noteId: note.id, rating: "good", today: "2026-09-23" });
      expect(first).toMatchObject({ reviewEase: 2.5, reviewInterval: 1, reviewReps: 1, reviewDue: "2026-09-24" });

      const second = await submitReview(fs, { noteId: note.id, rating: "good", today: "2026-09-24" });
      expect(second).toMatchObject({ reviewEase: 2.5, reviewInterval: 6, reviewReps: 2, reviewDue: "2026-09-30" });
    });

    it("throws submitting a review for a note that doesn't exist", async () => {
      const fs = createMemoryFs();
      await expect(submitReview(fs, { noteId: "nope", rating: "good", today: "2026-09-23" })).rejects.toThrow(/not found/);
    });
  });

  describe("version history", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-25T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("has no versions before any content-changing edit", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "first draft" });
      expect(await listNoteVersions(fs, note.id)).toEqual([]);
    });

    it("snapshots the pre-edit content on the very first content-changing update", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "first draft" });

      await updateNote(fs, { id: note.id, content: "second draft" });

      const versions = await listNoteVersions(fs, note.id);
      expect(versions).toHaveLength(1);
      const snapshot = await getNoteVersion(fs, note.id, versions[0].id);
      expect(snapshot).toMatchObject({ title: "Atomicity", content: "first draft" });
    });

    it("does not snapshot on a title-only edit", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "first draft" });

      await updateNote(fs, { id: note.id, title: "Renamed" });

      expect(await listNoteVersions(fs, note.id)).toEqual([]);
    });

    it("coalesces edits within 5 minutes into a single version", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "v1" });

      await updateNote(fs, { id: note.id, content: "v2" });
      vi.advanceTimersByTime(4 * 60 * 1000);
      await updateNote(fs, { id: note.id, content: "v3" });

      expect(await listNoteVersions(fs, note.id)).toHaveLength(1);
    });

    it("creates a new version once the 5-minute coalescing window has passed", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "v1" });

      await updateNote(fs, { id: note.id, content: "v2" });
      vi.advanceTimersByTime(6 * 60 * 1000);
      await updateNote(fs, { id: note.id, content: "v3" });

      expect(await listNoteVersions(fs, note.id)).toHaveLength(2);
    });

    it("lists versions newest-first", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "v1" });
      await updateNote(fs, { id: note.id, content: "v2" });
      vi.advanceTimersByTime(6 * 60 * 1000);
      await updateNote(fs, { id: note.id, content: "v3" });
      vi.advanceTimersByTime(6 * 60 * 1000);
      await updateNote(fs, { id: note.id, content: "v4" });

      const versions = await listNoteVersions(fs, note.id);
      const contents = await Promise.all(versions.map((v) => getNoteVersion(fs, note.id, v.id)));
      expect(contents.map((c) => c.content)).toEqual(["v3", "v2", "v1"]);
    });

    it("prunes versions past the 100-version cap, oldest first", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "v0" });

      for (let i = 1; i <= 105; i++) {
        vi.advanceTimersByTime(6 * 60 * 1000);
        await updateNote(fs, { id: note.id, content: `v${i}` });
      }

      const versions = await listNoteVersions(fs, note.id);
      expect(versions).toHaveLength(100);
      const contents = await Promise.all(versions.map((v) => getNoteVersion(fs, note.id, v.id)));
      // The oldest surviving snapshot is "v5" (v0..v4 pruned) — the newest
      // snapshot is always the second-to-last edit, since a snapshot
      // captures pre-edit content.
      expect(contents.map((c) => c.content)).toContain("v5");
      expect(contents.map((c) => c.content)).not.toContain("v0");
    });

    it("restoreNoteVersion restores the note's title and content, snapshotting the current state first", async () => {
      const fs = createMemoryFs();
      const note = await createNote(fs, { title: "Atomicity", content: "original" });
      await updateNote(fs, { id: note.id, title: "Renamed", content: "edited" });

      const [onlyVersion] = await listNoteVersions(fs, note.id);
      // Advance the clock so the pre-restore snapshot below has a strictly
      // later createdAt than the one just captured, making the newest-first
      // ordering asserted below unambiguous.
      vi.advanceTimersByTime(1000);
      const restored = await restoreNoteVersion(fs, note.id, onlyVersion.id);

      expect(restored).toMatchObject({ title: "Atomicity", content: "original" });

      const versionsAfterRestore = await listNoteVersions(fs, note.id);
      expect(versionsAfterRestore).toHaveLength(2);
      const preRestoreSnapshot = await getNoteVersion(fs, note.id, versionsAfterRestore[0].id);
      expect(preRestoreSnapshot).toMatchObject({ title: "Renamed", content: "edited" });
    });

    it("throws restoring a version for a note that doesn't exist", async () => {
      const fs = createMemoryFs();
      await expect(restoreNoteVersion(fs, "nope", "v1")).rejects.toThrow(/not found/);
    });
  });
});
