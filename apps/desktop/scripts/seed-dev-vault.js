// Puts sample notes in dev-vault/ so a development run of the desktop app
// opens onto a vault with something in it: resolved links, tags, a Map of
// Content, a journal entry, a template and a non-empty review queue. Runs
// ahead of `npm run dev:desktop`.
//
// It only ever writes to dev-vault/ at the repo root, the folder a dev run
// uses (see main.js), and only when that folder has no notes yet — so it
// can't reach, or overwrite, the vault the installed app reads.
//
// Same tsx/cjs hook main.js uses, so this plain-CommonJS script can require
// the engine's TypeScript source and seed through the real vault functions
// rather than hand-writing note files.
require("tsx/cjs");

const path = require("path");
const engine = require("@simplekasten/local-engine");
const { createNodeFsAdapter } = require("@simplekasten/local-engine/adapters/node");
const { SAMPLE_VAULT, SAMPLE_TEMPLATE, SAMPLE_REVIEW_TITLES } = require("../demo/sample-vault");

const DEV_VAULT_PATH = path.join(__dirname, "..", "..", "..", "dev-vault");

/** Local calendar day, matching how the apps ask the engine for "today". */
function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function main() {
  // A dev run with SIMPLEKASTEN_VAULT set is pointed at a folder the
  // developer chose on purpose, which may well hold real notes. Seeding is
  // for the throwaway dev-vault only.
  if (process.env.SIMPLEKASTEN_VAULT) {
    console.log("seed: SIMPLEKASTEN_VAULT is set, leaving that vault alone.");
    return;
  }

  const fs = createNodeFsAdapter(DEV_VAULT_PATH);

  const existing = await engine.listNotes(fs);
  if (existing.length > 0) {
    console.log(
      `seed: dev-vault already has ${existing.length} note(s), nothing to do.\n` +
        "      To start over: delete dev-vault/, or use Settings -> Purge vault in the app.",
    );
    return;
  }

  // Created in order, so each note's zettelId matches the sample data's own.
  const idByTitle = new Map();
  for (const note of SAMPLE_VAULT) {
    const created = await engine.createNote(fs, {
      title: note.title,
      content: note.content,
      type: note.type,
    });
    idByTitle.set(note.title, created.id);
  }

  // Set as the daily default before the journal note is created, so that
  // note comes out pre-filled from it the way a real first run would.
  const template = await engine.createTemplate(fs, SAMPLE_TEMPLATE);
  await engine.setDefaultForDailyNote(fs, template.id);
  await engine.getOrCreateDailyNote(fs, todayLocal());

  for (const title of SAMPLE_REVIEW_TITLES) {
    const id = idByTitle.get(title);
    if (id) await engine.addToReviewQueue(fs, id, todayLocal());
  }

  console.log(
    `seed: wrote ${SAMPLE_VAULT.length} notes, 1 journal entry, 1 template and ` +
      `${SAMPLE_REVIEW_TITLES.length} review-queue entries to dev-vault/.`,
  );
}

main().catch((err) => {
  // A failed seed must not stop a dev run - the app works fine on an empty
  // vault, so report and let the dev server start.
  console.error("seed: skipped, could not write dev-vault:", err.message);
});
