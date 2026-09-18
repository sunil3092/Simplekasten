import { describe, expect, it } from "vitest";
import { createMemoryFs } from "./memory-fs.test-helper";
import {
  createNote,
  deleteNote,
  getGraph,
  getNoteById,
  listNotes,
  listTags,
  searchNotes,
  updateNote,
  createAttachment,
  deleteAttachment,
  getAttachmentFilePath,
  listAttachments,
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
});
