import type { Page } from "@playwright/test";

/**
 * Stubs the Electron preload bridge (`window.simplekasten`) so the renderer
 * runs in a plain browser. Notes are in-memory fixtures; content writes are
 * no-ops, but deletes and attachment changes update the fixtures so specs
 * can see their effect.
 */
export async function stubBridge(page: Page, settings: { theme: string; themeMode: "system" | "light" | "dark" }) {
  await page.addInitScript((s) => {
    const notes: {
      id: string;
      zettelId: string;
      title: string;
      content: string;
      type: string;
      noteDate?: string;
      reviewDue?: string | null;
      reviewEase?: number;
      reviewInterval?: number;
      reviewReps?: number;
    }[] = [
      { id: "a", zettelId: "1", title: "Atomic Habits", content: "Small changes compound.", type: "fleeting" },
      { id: "b", zettelId: "2", title: "Systems", content: "See [[Atomic Habits]].", type: "permanent" },
    ];
    let nextNote = 1;
    const templates: { id: string; name: string; content: string; isDefaultForDailyNote: boolean }[] = [];
    let nextTemplate = 1;
    // "Atomic Habits" starts with one earlier version, as if it had been
    // edited before — enough for specs to exercise the version list and
    // diff view without simulating the real 5-minute coalescing window.
    const versions: { id: string; noteId: string; title: string; content: string; createdAt: string }[] = [
      { id: "ver1", noteId: "a", title: "Atomic Habits", content: "Small changes compound.\nStart tiny.", createdAt: "2026-09-20T12:00:00.000Z" },
    ];
    let nextVersion = 2;
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
      return {
        ...n,
        createdAt: stamp,
        updatedAt: stamp,
        tagNames: [],
        attachments: own,
        backlinks,
        contents,
        reviewDue: n.reviewDue ?? null,
        reviewEase: n.reviewEase ?? 2.5,
        reviewInterval: n.reviewInterval ?? 0,
        reviewReps: n.reviewReps ?? 0,
      };
    };
    // Same date-only arithmetic as srs.ts's addDays, kept self-contained here
    // since addInitScript's function body can't import from the app.
    const addDays = (date: string, days: number) => {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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
        getOrCreateDailyNote: async (date: string) => {
          const existing = notes.find((n) => n.noteDate === date);
          if (existing) return detail(existing.id);
          const id = `daily${nextNote++}`;
          notes.push({ id, zettelId: String(notes.length + 1), title: date, content: "", type: "daily", noteDate: date });
          return detail(id);
        },
        listDailyNotes: async (limit = 30) =>
          notes
            .filter((n) => n.type === "daily")
            .sort((a, b) => (b.noteDate ?? "").localeCompare(a.noteDate ?? ""))
            .slice(0, limit)
            .map(({ id, zettelId, title, type }) => ({ id, zettelId, title, type, updatedAt: stamp })),
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
        listTemplates: async () => templates.slice().sort((a, b) => a.name.localeCompare(b.name)),
        createTemplate: async (input: { name: string; content: string }) => {
          const t = { id: `tpl${nextTemplate++}`, name: input.name, content: input.content, isDefaultForDailyNote: false };
          templates.push(t);
          return t;
        },
        updateTemplate: async (input: { id: string; name?: string; content?: string }) => {
          const t = templates.find((x) => x.id === input.id)!;
          if (input.name !== undefined) t.name = input.name;
          if (input.content !== undefined) t.content = input.content;
          return t;
        },
        deleteTemplate: async (id: string) => {
          const idx = templates.findIndex((t) => t.id === id);
          if (idx !== -1) templates.splice(idx, 1);
        },
        setDefaultForDailyNote: async (id: string) => {
          for (const t of templates) t.isDefaultForDailyNote = t.id === id;
          return templates.find((t) => t.id === id)!;
        },
        applyTemplate: async (input: { noteId: string; templateId: string }) => {
          const note = notes.find((n) => n.id === input.noteId)!;
          const template = templates.find((t) => t.id === input.templateId)!;
          const expanded = template.content.replaceAll("{{title}}", note.title);
          note.content = note.content ? `${note.content}\n\n${expanded}` : expanded;
          return detail(note.id);
        },
        addToReviewQueue: async (noteId: string, today: string) => {
          const note = notes.find((n) => n.id === noteId)!;
          note.reviewDue = today;
          note.reviewEase = 2.5;
          note.reviewInterval = 0;
          note.reviewReps = 0;
          return detail(noteId);
        },
        removeFromReviewQueue: async (noteId: string) => {
          const note = notes.find((n) => n.id === noteId)!;
          note.reviewDue = null;
          note.reviewEase = 2.5;
          note.reviewInterval = 0;
          note.reviewReps = 0;
          return detail(noteId);
        },
        listDueForReview: async (date: string) =>
          notes
            .filter((n) => n.reviewDue != null && n.reviewDue <= date)
            .slice()
            .sort((a, b) => (a.reviewDue as string).localeCompare(b.reviewDue as string))
            .map(({ id, zettelId, title, type }) => ({ id, zettelId, title, type, updatedAt: stamp })),
        submitReview: async (input: { noteId: string; rating: "again" | "hard" | "good" | "easy"; today: string }) => {
          const note = notes.find((n) => n.id === input.noteId)!;
          const interval = input.rating === "again" ? 1 : (note.reviewInterval ?? 0) + 3;
          note.reviewReps = input.rating === "again" ? 0 : (note.reviewReps ?? 0) + 1;
          note.reviewInterval = interval;
          note.reviewDue = addDays(input.today, interval);
          return detail(note.id);
        },
        listNoteVersions: async (noteId: string) =>
          versions
            .filter((v) => v.noteId === noteId)
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(({ id, createdAt, title }) => ({ id, createdAt, title })),
        getNoteVersion: async (noteId: string, versionId: string) => {
          const v = versions.find((x) => x.noteId === noteId && x.id === versionId)!;
          return { title: v.title, content: v.content, createdAt: v.createdAt };
        },
        restoreNoteVersion: async (noteId: string, versionId: string) => {
          const note = notes.find((n) => n.id === noteId)!;
          const target = versions.find((v) => v.noteId === noteId && v.id === versionId)!;
          versions.push({ id: `ver${nextVersion++}`, noteId, title: note.title, content: note.content, createdAt: "2026-09-25T00:00:00.000Z" });
          note.title = target.title;
          note.content = target.content;
          return detail(noteId);
        },
      },
    };
  }, settings);
}
