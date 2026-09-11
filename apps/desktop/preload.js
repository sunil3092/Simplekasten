const { contextBridge, ipcRenderer } = require("electron");

// Exposes the local vault engine to the renderer as `window.simplekasten`.
// The renderer (apps/web's UI) never touches `fs` directly — every call
// round-trips through the main process via ipcRenderer.invoke, keeping
// contextIsolation intact. See apps/web/src/lib/localVaultClient.ts for the
// trpc-shaped wrapper the UI actually calls.
contextBridge.exposeInMainWorld("simplekasten", {
  vault: {
    listNotes: (tag) => ipcRenderer.invoke("vault:listNotes", tag),
    getNoteById: (id) => ipcRenderer.invoke("vault:getNoteById", id),
    createNote: (input) => ipcRenderer.invoke("vault:createNote", input),
    updateNote: (input) => ipcRenderer.invoke("vault:updateNote", input),
    deleteNote: (id) => ipcRenderer.invoke("vault:deleteNote", id),
    search: (query) => ipcRenderer.invoke("vault:search", query),
    getGraph: () => ipcRenderer.invoke("vault:getGraph"),
    listTags: () => ipcRenderer.invoke("vault:listTags"),
    getVaultPath: () => ipcRenderer.invoke("vault:getVaultPath"),
    chooseVaultFolder: () => ipcRenderer.invoke("vault:chooseVaultFolder"),
  },
});
