// Backs the `trpc` object with calls into the Electron main process (see
// apps/desktop/preload.js / main.js) instead of the network, when this page
// is running inside the desktop shell. Implements the exact call shape
// `Vault` in app/page.tsx already uses (`.query()`/`.mutate()` per method)
// so none of that component's ~15 call sites need to change.
//
// There is exactly one local vault today (no folder-switcher UI yet, same
// scope limit the mobile app already has), so `kbId` is accepted wherever
// the shared UI passes one but ignored — every call always targets
// `window.simplekasten`'s single active vault folder.
const LOCAL_KB = { id: "local", name: "My Vault", isDefault: true };

declare global {
  interface Window {
    simplekasten?: {
      vault: {
        listNotes: (tag?: string) => Promise<unknown>;
        getNoteById: (id: string) => Promise<unknown>;
        createNote: (input: unknown) => Promise<unknown>;
        updateNote: (input: unknown) => Promise<unknown>;
        deleteNote: (id: string) => Promise<unknown>;
        search: (query: string) => Promise<unknown>;
        getGraph: () => Promise<unknown>;
        listTags: () => Promise<unknown>;
        getVaultPath: () => Promise<string>;
        chooseVaultFolder: () => Promise<string>;
      };
    };
  }
}

export function isLocalMode(): boolean {
  return typeof window !== "undefined" && Boolean(window.simplekasten);
}

function vault() {
  if (!window.simplekasten) throw new Error("window.simplekasten is not available — not running inside Electron.");
  return window.simplekasten.vault;
}

export const localTrpc: any = {
  knowledgeBase: {
    list: { query: async () => [LOCAL_KB] },
    create: { mutate: async () => LOCAL_KB },
  },
  note: {
    list: { query: async ({ tag }: { tag?: string }) => vault().listNotes(tag) },
    getById: { query: async ({ id }: { id: string }) => vault().getNoteById(id) },
    create: {
      mutate: async ({ title, content, type }: { title: string; content: string; type?: string }) =>
        vault().createNote({ title, content, type }),
    },
    update: {
      mutate: async ({ id, title, content, type }: { id: string; title?: string; content?: string; type?: string }) =>
        vault().updateNote({ id, title, content, type }),
    },
    delete: { mutate: async ({ id }: { id: string }) => vault().deleteNote(id) },
    graph: { query: async () => vault().getGraph() },
    search: { query: async ({ query }: { query: string }) => vault().search(query) },
  },
  tag: {
    list: { query: async () => vault().listTags() },
  },
  auth: {
    login: { mutate: async () => ({ accessToken: "", refreshToken: "" }) },
    register: { mutate: async () => ({ accessToken: "", refreshToken: "" }) },
    logout: { mutate: async () => ({ ok: true }) },
  },
};

// The web app's export streams a Postgres-backed zip; in local mode the
// vault folder on disk already *is* the portable, human-readable export —
// nothing to generate. Surface that instead of pretending to download one.
export async function localDownloadVaultExport(): Promise<void> {
  const path = await vault().getVaultPath();
  window.alert(`Your notes are already plain files on disk:\n${path}`);
}
