// tsx's CJS require hook lets this plain-CommonJS main process require
// @simplekasten/local-engine's TypeScript source directly — same "no build
// step, run TS at dev-time" approach apps/api already uses with `tsx`.
require("tsx/cjs");

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const localEngine = require("@simplekasten/local-engine");
const { createNodeFsAdapter } = require("@simplekasten/local-engine/adapters/node");

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
  ipcMain.handle("vault:chooseVaultFolder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return getVaultPath();

    saveSettings({ ...loadSettings(), vaultPath: result.filePaths[0] });
    return result.filePaths[0];
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
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
