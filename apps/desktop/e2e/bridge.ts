import type { Page } from "@playwright/test";

/**
 * Stubs the Electron preload bridge (`window.simplekasten`) so the renderer
 * runs in a plain browser. Notes are in-memory fixtures; content writes are
 * no-ops, but deletes and attachment changes update the fixtures so specs
 * can see their effect.
 */
export async function stubBridge(page: Page, settings: { theme: string; themeMode: "system" | "light" | "dark" }) {
  await page.addInitScript((s) => {
    const notes = [
      { id: "a", zettelId: "1", title: "Atomic Habits", content: "Small changes compound.", type: "fleeting" },
      { id: "b", zettelId: "2", title: "Systems", content: "See [[Atomic Habits]].", type: "permanent" },
    ];
    const stamp = "2026-09-21T00:00:00.000Z";
    // "Atomic Habits" starts with one photo and one voice note, as if they'd
    // been added on mobile. Files are served as data: URLs below.
    let attachments = [
      { id: "p1", noteId: "a", kind: "photo", filename: "whiteboard.svg", mimeType: "image/svg+xml", createdAt: stamp },
      { id: "v1", noteId: "a", kind: "voice", filename: "idea.wav", mimeType: "audio/wav", createdAt: stamp },
    ];
    let nextAttachment = 1;
    const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#0cb2c0"/></svg>')}`;
    // 44-byte header of an empty PCM WAV — enough for <audio> to load.
    const silence = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
    const detail = (id: string) => {
      const n = notes.find((x) => x.id === id)!;
      const backlinks = id === "a" ? [{ noteId: "b", title: "Systems", zettelId: "2" }] : [];
      const contents =
        id === "b" ? [{ noteId: "a", title: "Atomic Habits", zettelId: "1", resolved: true }] : [];
      const own = attachments.filter((a) => a.noteId === id);
      return { ...n, createdAt: stamp, updatedAt: stamp, tagNames: [], attachments: own, backlinks, contents };
    };
    (window as unknown as { simplekasten: unknown }).simplekasten = {
      settings: { get: async () => s, set: async () => {} },
      themes: {
        list: async () => ({ themes: [], skipped: [] }),
        install: async () => ({ ok: false, errors: [], canceled: true }),
        installFromText: async () => ({ ok: false, errors: [] }),
        remove: async () => {},
      },
      vault: {
        listNotes: async () => notes.map(({ content: _c, ...rest }) => ({ ...rest, updatedAt: stamp })),
        getNoteById: async (id: string) => detail(id),
        createNote: async () => detail("a"),
        updateNote: async (input: { id: string }) => detail(input.id),
        deleteNote: async (id: string) => {
          notes.splice(
            notes.findIndex((n) => n.id === id),
            1,
          );
        },
        search: async () => [],
        getGraph: async () => ({
          nodes: notes.map(({ id, zettelId, title, type }) => ({ id, zettelId, title, type })),
          edges: [{ source: "b", target: "a" }],
        }),
        listTags: async () => [],
        getVaultPath: async () => "/fixture",
        chooseVaultFolder: async () => "/fixture",
        addAttachment: async (noteId: string) => {
          const a = { id: `new${nextAttachment++}`, noteId, kind: "photo", filename: "added.svg", mimeType: "image/svg+xml", createdAt: stamp };
          attachments.push(a);
          return a;
        },
        deleteAttachment: async (id: string) => {
          attachments = attachments.filter((a) => a.id !== id);
        },
        attachmentUrl: (id: string) => (attachments.find((a) => a.id === id)?.kind === "voice" ? silence : photo),
      },
    };
  }, settings);
}
