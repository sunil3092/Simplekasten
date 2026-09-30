import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Runs the *packaged* app (release/win-unpacked), not the dev renderer — the
// only way to catch breakage that exists solely once bundled, like the main
// process transpiling TypeScript at runtime via tsx, which spawns an esbuild
// binary that isn't in the package. Skipped unless `npm run build` has run.
const EXE: Record<string, string> = {
  win32: path.join("win-unpacked", "Simplekasten.exe"),
  darwin: path.join("mac", "Simplekasten.app", "Contents", "MacOS", "Simplekasten"),
  linux: path.join("linux-unpacked", "simplekasten"),
};
const packaged = path.join(__dirname, "..", "release", EXE[process.platform] ?? "");

test("the packaged app boots, reads its vault and writes a note", async () => {
  test.skip(!existsSync(packaged), "no packaged build — run `npm run build -w @simplekasten/desktop` first");
  test.setTimeout(120_000);

  // Its own vault and user data, so a real vault is never touched.
  const scratch = mkdtempSync(path.join(tmpdir(), "simplekasten-packaged-"));
  const vault = path.join(scratch, "vault");
  const userData = path.join(scratch, "user");
  mkdirSync(vault);
  mkdirSync(userData);
  writeFileSync(path.join(userData, "settings.json"), JSON.stringify({ vaultPath: vault }));

  // VS Code sets ELECTRON_RUN_AS_NODE, which would start the app as plain Node.
  const env = { ...process.env } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_START_URL;

  const app = await electron.launch({ executablePath: packaged, args: [`--user-data-dir=${userData}`], env });
  try {
    const win = await app.firstWindow({ timeout: 60_000 });
    // The window exists at all only if the main process survived startup.
    await expect(win.getByText(path.basename(vault), { exact: true })).toBeVisible({ timeout: 45_000 });
    // Served from the packaged static export, not a dev server.
    expect(await win.evaluate(() => location.href)).toContain("app.asar");

    await win.getByRole("button", { name: "New note" }).first().click();
    await win.locator("input[placeholder='Untitled']").fill("Packaged build works");
    await expect(win.getByText("Saved")).toBeVisible();
    expect(existsSync(path.join(vault, "notes"))).toBe(true);
  } finally {
    await app.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
