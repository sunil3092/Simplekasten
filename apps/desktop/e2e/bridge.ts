import type { Page } from "@playwright/test";

/**
 * Stubs the Electron preload bridge (`window.simplekasten`) so the renderer
 * runs in a plain browser. Notes are in-memory fixtures; writes are no-ops.
 */
export async function stubBridge(page: Page, settings: { theme: string; themeMode: "system" | "light" | "dark" }) {
  await page.addInitScript((s) => {
    const notes = [
      { id: "a", zettelId: "1", title: "Atomic Habits", content: "Small changes compound.", type: "fleeting" },
      { id: "b", zettelId: "2", title: "Systems", content: "See [[Atomic Habits]].", type: "permanent" },
    ];
    const stamp = "2026-09-21T00:00:00.000Z";
    const detail = (id: string) => {
      const n = notes.find((x) => x.id === id)!;
      const backlinks = id === "a" ? [{ noteId: "b", title: "Systems", zettelId: "2" }] : [];
      const contents =
        id === "b" ? [{ noteId: "a", title: "Atomic Habits", zettelId: "1", resolved: true }] : [];
      return { ...n, createdAt: stamp, updatedAt: stamp, tagNames: [], attachments: [], backlinks, contents };
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
        deleteNote: async () => {},
        search: async () => [],
        getGraph: async () => ({
          nodes: notes.map(({ id, zettelId, title, type }) => ({ id, zettelId, title, type })),
          edges: [{ source: "b", target: "a" }],
        }),
        listTags: async () => [],
        getVaultPath: async () => "/fixture",
        chooseVaultFolder: async () => "/fixture",
      },
    };
  }, settings);
}
