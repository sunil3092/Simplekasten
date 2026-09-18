// Talks to the Electron main process via the preload bridge (see
// apps/desktop/preload.js) — every note/tag/graph/search operation is a
// local filesystem call, never a network request. No auth: there's nothing
// to log into, this window only ever has one local vault open.
declare global {
  interface Window {
    simplekasten: {
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

function vault() {
  return window.simplekasten.vault;
}

export const vaultClient = {
  listNotes: (tag?: string) => vault().listNotes(tag),
  getNoteById: (id: string) => vault().getNoteById(id),
  createNote: (input: { title: string; content: string; type?: string }) => vault().createNote(input),
  updateNote: (input: { id: string; title?: string; content?: string; type?: string }) => vault().updateNote(input),
  deleteNote: (id: string) => vault().deleteNote(id),
  search: (query: string) => vault().search(query),
  getGraph: () => vault().getGraph(),
  listTags: () => vault().listTags(),
  getVaultPath: () => vault().getVaultPath(),
  chooseVaultFolder: () => vault().chooseVaultFolder(),
};

/** The vault folder on disk already *is* the portable export — nothing to zip. */
export async function showVaultLocation(): Promise<void> {
  const path = await vaultClient.getVaultPath();
  window.alert(`Your notes are plain files on disk:\n${path}`);
}
