import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { createNote, registerAndEnterVault } from "./helpers";

test("exporting the vault downloads a zip with one markdown file per note", async ({ page }) => {
  await registerAndEnterVault(page, "Export Test");
  await createNote(page, "Atomicity", "One idea per note. #zettelkasten");
  await createNote(page, "Linking Notes", "See [[Atomicity]] for the first principle.");

  await page.getByRole("button", { name: /my vault/i }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export vault…" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^my-vault-export\.zip$/);

  const zipPath = await download.path();
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const filenames = Object.keys(zip.files);
  expect(filenames).toHaveLength(2);

  const atomicityName = filenames.find((f) => f.includes("atomicity"))!;
  const content = await zip.files[atomicityName].async("string");
  expect(content).toContain('title: "Atomicity"');
  expect(content).toContain("One idea per note. #zettelkasten");

  const linkingName = filenames.find((f) => f.includes("linking-notes"))!;
  const linkingContent = await zip.files[linkingName].async("string");
  expect(linkingContent).toContain("[[Atomicity]]");
});
