// tsx's CJS require hook lets this plain-CommonJS main process require
// @simplekasten/local-engine's TypeScript source directly — same "no build
// step, run TS at dev-time" approach apps/desktop already uses with `tsx`.
require("tsx/cjs");

const { app, BrowserWindow, ipcMain, dialog, net, protocol } = require("electron");
const { pathToFileURL } = require("url");
const fs = require("fs");
const path = require("path");
const localEngine = require("@simplekasten/local-engine");
const { createNodeFsAdapter } = require("@simplekasten/local-engine/adapters/node");
const themesLib = require("@simplekasten/themes");

const START_URL =
  process.env.ELECTRON_START_URL ||
  `file://${path.join(__dirname, "out", "index.html")}`;

const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Single active vault folder for now — same "default vault only" scope the
// mobile app already has, not a full multi-vault switcher.
function getVaultPath() {
  const settings = loadSettings();
  if (settings.vaultPath) return settings.vaultPath;

  const defaultPath = path.join(app.getPath("documents"), "Simplekasten");
  fs.mkdirSync(defaultPath, { recursive: true });
  saveSettings({ ...settings, vaultPath: defaultPath });
  return defaultPath;
}

function currentAdapter() {
  return createNodeFsAdapter(getVaultPath());
}

// Every data operation (notes, links, tags, search, graph) is served from
// this process's local filesystem — no network call, no login, matching the
// desktop app's fully-offline design. Method names mirror
// @simplekasten/local-engine's exports 1:1; see preload.js for the bridge
// the renderer actually calls.
// The engine classifies attachments by mime type (image/* → photo,
// audio/* → voice); the file picker only knows extensions.
const ATTACHMENT_MIME_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  m4a: "audio/m4a",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
};

// sk-attachment://<id> serves an attachment's file from the current vault,
// so the renderer can use it directly in <img>/<audio> without ever getting
// a raw filesystem path. Registered as privileged + streaming so <audio>
// can seek (range requests) and the dev server origin can load it.
protocol.registerSchemesAsPrivileged([
  { scheme: "sk-attachment", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function registerAttachmentProtocol() {
  protocol.handle("sk-attachment", async (request) => {
    const id = new URL(request.url).hostname;
    try {
      const file = await localEngine.getAttachmentFilePath(currentAdapter(), id);
      return net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
    } catch {
      return new Response("Attachment not found", { status: 404 });
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle("vault:listNotes", (_event, tag) => localEngine.listNotes(currentAdapter(), tag));
  ipcMain.handle("vault:getNoteById", (_event, id) => localEngine.getNoteById(currentAdapter(), id));
  ipcMain.handle("vault:createNote", (_event, input) => localEngine.createNote(currentAdapter(), input));
  ipcMain.handle("vault:updateNote", (_event, input) => localEngine.updateNote(currentAdapter(), input));
  ipcMain.handle("vault:deleteNote", (_event, id) => localEngine.deleteNote(currentAdapter(), id));
  ipcMain.handle("vault:search", (_event, query) => localEngine.searchNotes(currentAdapter(), query));
  ipcMain.handle("vault:getGraph", () => localEngine.getGraph(currentAdapter()));
  ipcMain.handle("vault:listTags", () => localEngine.listTags(currentAdapter()));
  ipcMain.handle("vault:getVaultPath", () => getVaultPath());
  ipcMain.handle("vault:addAttachment", async (_event, noteId) => {
    const result = await dialog.showOpenDialog({
      title: "Attach a photo or audio file",
      properties: ["openFile"],
      filters: [{ name: "Images and audio", extensions: Object.keys(ATTACHMENT_MIME_TYPES) }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const file = result.filePaths[0];
    const mimeType = ATTACHMENT_MIME_TYPES[path.extname(file).slice(1).toLowerCase()];
    if (!mimeType) throw new Error("Only image and audio files can be attached.");
    return localEngine.createAttachment(currentAdapter(), {
      noteId: String(noteId),
      sourcePath: file,
      filename: path.basename(file),
      mimeType,
    });
  });
  ipcMain.handle("vault:deleteAttachment", (_event, id) => localEngine.deleteAttachment(currentAdapter(), String(id)));
  ipcMain.handle("vault:chooseVaultFolder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return getVaultPath();

    saveSettings({ ...loadSettings(), vaultPath: result.filePaths[0] });
    return result.filePaths[0];
  });

  // ---- Themes & appearance settings -------------------------------------
  const THEME_MODES = ["system", "light", "dark"];
  const MAX_THEME_FILE_BYTES = 256 * 1024;

  ipcMain.handle("settings:get", () => {
    const s = loadSettings();
    return {
      theme: typeof s.theme === "string" ? s.theme : themesLib.DEFAULT_THEME_ID,
      themeMode: THEME_MODES.includes(s.themeMode) ? s.themeMode : "system",
    };
  });

  ipcMain.handle("settings:set", (_event, patch) => {
    const next = { ...loadSettings() };
    if (typeof patch?.theme === "string") next.theme = patch.theme;
    if (THEME_MODES.includes(patch?.themeMode)) next.themeMode = patch.themeMode;
    saveSettings(next);
  });

  ipcMain.handle("themes:list", () => themesLib.listInstalledThemes(currentAdapter()));
  ipcMain.handle("themes:installFromText", (_event, json) =>
    themesLib.installTheme(currentAdapter(), typeof json === "string" ? json : ""),
  );
  ipcMain.handle("themes:remove", (_event, id) => themesLib.removeTheme(currentAdapter(), String(id)));
  ipcMain.handle("themes:install", async () => {
    const result = await dialog.showOpenDialog({
      title: "Install theme",
      properties: ["openFile"],
      filters: [{ name: "Theme (JSON)", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, errors: [], canceled: true };

    const file = result.filePaths[0];
    if (fs.statSync(file).size > MAX_THEME_FILE_BYTES) {
      return { ok: false, errors: ["File is too large to be a theme (max 256 KB)"] };
    }
    return themesLib.installTheme(currentAdapter(), fs.readFileSync(file, "utf8"));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: "Simplekasten",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(START_URL);
}

app.whenReady().then(() => {
  registerAttachmentProtocol();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
