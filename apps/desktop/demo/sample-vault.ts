import type { SeedNote } from "../e2e/bridge";

// The one set of sample notes this repo's non-production surfaces share:
// the README demo tour (tour.demo.ts, in-memory via the stubbed bridge) and
// a development run's dev-vault/ (scripts/seed-dev-vault.js, real files on
// disk). Keeping it in one place means the GIF in the README and the vault
// you actually click around in during development show the same thing.
//
// It is written to exercise the features rather than to be realistic: a
// structure note acting as a Map of Content, resolved [[wiki-links]] in both
// directions, two #hashtag groups, and one note of every type.

const note = (n: number, title: string, type: string, content: string): SeedNote => ({
  id: `n${n}`,
  zettelId: String(n),
  title,
  type,
  content,
  tags: [],
});

export const SAMPLE_VAULT: SeedNote[] = [
  note(
    1,
    "Learning Systems",
    "structure",
    "A map of how I study.\n\n- [[Zettelkasten Method]]\n- [[Spaced Repetition]]\n- [[Active Recall]]\n- [[Feynman Technique]]\n- [[Forgetting Curve]]",
  ),
  note(2, "Zettelkasten Method", "permanent", "A slip-box of small notes that link to each other instead of living in folders. #method\n\nBuilt on [[Atomic Notes]] and [[Linking Over Filing]]."),
  note(3, "Atomic Notes", "permanent", "One idea per note, written so it stands on its own. #method\n\nSmall notes are what make [[Linking Over Filing]] possible."),
  note(4, "Linking Over Filing", "permanent", "A note's value comes from what it connects to, not where it is stored. #method"),
  note(
    5,
    "Spaced Repetition",
    "literature",
    "Review just before you would forget; each successful review pushes the next one further out. #memory\n\nA direct answer to the [[Forgetting Curve]], and it works best with [[Active Recall]].",
  ),
  note(6, "Active Recall", "literature", "Pull the answer out of memory instead of re-reading it. #memory\n\nEvery recall flattens the [[Forgetting Curve]] a little."),
  note(7, "Forgetting Curve", "permanent", "Memory of new material drops fast at first, then levels off. #memory\n\nEach review resets the curve and makes it shallower."),
  note(8, "Feynman Technique", "fleeting", "Explain it in plain words, as if teaching a beginner; the gaps show what you don't understand yet."),
  note(9, "Reading Inbox", "fleeting", "Books and articles to process later."),
];

/** Seeded as a template, and set as the default for new journal notes. */
export const SAMPLE_TEMPLATE = {
  name: "Daily Log",
  content: "# {{title}}\n\n## Captured\n\n- \n\n## Worth keeping\n\n- \n",
};

/** Titles put into the spaced-repetition queue, so Review isn't empty. */
export const SAMPLE_REVIEW_TITLES = ["Zettelkasten Method", "Forgetting Curve"];
