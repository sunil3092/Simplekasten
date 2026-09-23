const { contextBridge, ipcRenderer } = require("electron");

// Exposes the local vault engine to the renderer as `window.simplekasten`.
// The renderer never touches `fs` directly — every call round-trips through
// the main process via ipcRenderer.invoke, keeping contextIsolation intact.
// See apps/desktop/src/lib/vaultClient.ts for the wrapper the UI actually
// calls.
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
    getOrCreateDailyNote: (date) => ipcRenderer.invoke("vault:getOrCreateDailyNote", date),
    listDailyNotes: (limit) => ipcRenderer.invoke("vault:listDailyNotes", limit),
    listTemplates: () => ipcRenderer.invoke("vault:listTemplates"),
    createTemplate: (input) => ipcRenderer.invoke("vault:createTemplate", input),
    updateTemplate: (input) => ipcRenderer.invoke("vault:updateTemplate", input),
    deleteTemplate: (id) => ipcRenderer.invoke("vault:deleteTemplate", id),
    setDefaultForDailyNote: (id) => ipcRenderer.invoke("vault:setDefaultForDailyNote", id),
    applyTemplate: (input) => ipcRenderer.invoke("vault:applyTemplate", input),
    addToReviewQueue: (noteId, today) => ipcRenderer.invoke("vault:addToReviewQueue", noteId, today),
    removeFromReviewQueue: (noteId) => ipcRenderer.invoke("vault:removeFromReviewQueue", noteId),
    listDueForReview: (date) => ipcRenderer.invoke("vault:listDueForReview", date),
    submitReview: (input) => ipcRenderer.invoke("vault:submitReview", input),
    getVaultPath: () => ipcRenderer.invoke("vault:getVaultPath"),
    chooseVaultFolder: () => ipcRenderer.invoke("vault:chooseVaultFolder"),
    addAttachment: (noteId) => ipcRenderer.invoke("vault:addAttachment", noteId),
    deleteAttachment: (id) => ipcRenderer.invoke("vault:deleteAttachment", id),
    attachmentUrl: (id) => `sk-attachment://${encodeURIComponent(id)}`,
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (patch) => ipcRenderer.invoke("settings:set", patch),
  },
  themes: {
    list: () => ipcRenderer.invoke("themes:list"),
    install: () => ipcRenderer.invoke("themes:install"),
    installFromText: (json) => ipcRenderer.invoke("themes:installFromText", json),
    remove: (id) => ipcRenderer.invoke("themes:remove", id),
  },
});
