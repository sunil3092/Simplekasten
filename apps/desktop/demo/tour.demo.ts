import { test, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import path from "path";
import sharp from "sharp";
import { stubBridge, type SeedNote } from "../e2e/bridge";

// Builds docs/demo/tour.gif, the walkthrough in the root README. It drives
// the real renderer against the stubbed bridge (like the e2e specs), takes
// one captioned screenshot per step and joins them into an animated GIF.
// Run with `npm run demo -w @simplekasten/desktop` after a UI change that
// makes the walkthrough out of date.

const OUT_DIR = path.join(__dirname, "..", "..", "..", "docs", "demo");
const WIDTH = 1280;
const HEIGHT = 760;
const GIF_WIDTH = 1000;
const SECONDS_PER_FRAME = 3.2;

const note = (n: number, title: string, type: string, content: string): SeedNote => ({
  id: `n${n}`,
  zettelId: String(n),
  title,
  type,
  content,
  tags: [],
});

const VAULT: SeedNote[] = [
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

async function caption(page: Page, text: string) {
  await page.evaluate((text) => {
    let bar = document.getElementById("demo-caption");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "demo-caption";
      bar.style.cssText =
        "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;max-width:880px;padding:12px 22px;" +
        "border-radius:12px;background:#0f172a;color:#f8fafc;font:600 17px/1.4 Inter,system-ui,sans-serif;text-align:center;" +
        "box-shadow:0 10px 30px rgba(15,23,42,.35);pointer-events:none";
      document.body.appendChild(bar);
    }
    bar.textContent = text;
  }, text);
}

test("build the README tour", async ({ page }) => {
  test.setTimeout(120_000);
  const frames: Buffer[] = [];
  const frame = async (text: string) => {
    await caption(page, text);
    // Let fades, focus rings and the graph's physics settle.
    await page.waitForTimeout(700);
    frames.push(await page.screenshot());
  };

  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await stubBridge(page, { theme: "classic", themeMode: "light" }, VAULT);
  // The sidebar heading is the vault folder's name.
  await page.addInitScript(() => {
    (window as unknown as { simplekasten: { vault: { getVaultPath: () => Promise<string> } } }).simplekasten.vault.getVaultPath = async () => "/Documents/My Notes";
  });
  await page.goto("/");
  const sidebar = page.locator("aside").first();

  // 1. A note, its links and backlinks.
  await sidebar.getByRole("button", { name: /Spaced Repetition/ }).click();
  await frame("1 · Notes are plain Markdown. The panel on the right shows what a note links to and what links back.");

  // 2. Linking and tagging while writing.
  const editor = page.locator("main .cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Try the [[Fey");
  await page.waitForTimeout(300);
  await frame("2 · Type [[ to link another note, or # to reuse a tag. Both suggest as you type.");
  await page.keyboard.press("Enter");

  // 3. Jump anywhere.
  await page.keyboard.press("Control+k");
  await frame("3 · Ctrl/Cmd+K jumps to any note. Start with > to run a command instead.");
  await page.keyboard.press("Escape");

  // 4. Tags and the collapsible sidebar.
  await sidebar.locator("summary", { hasText: "Create" }).click();
  await sidebar.locator("summary", { hasText: "Views" }).click();
  await sidebar.getByRole("button", { name: /#memory/ }).click();
  await frame("4 · Click a tag to filter the note list. Sidebar sections fold away when you don't need them.");
  await sidebar.getByRole("button", { name: /#memory/ }).click();
  await sidebar.locator("summary", { hasText: "Views" }).click();

  // 5. The journal.
  await sidebar.getByRole("button", { name: /Today/ }).click();
  await page.locator("main .cm-content").click();
  await page.keyboard.type("Reviewed three cards this morning. [[Spaced Repetition]] is finally sticking.");
  await frame("5 · Today opens the day's journal note. Journal entries get the #journalentry tag on their own.");

  // 6. Graph view.
  await sidebar.getByRole("button", { name: "Graph view" }).click();
  await page.getByTestId("graph-view").getByRole("button", { name: "Whole vault" }).click();
  await page.waitForTimeout(3000);
  await frame("6 · Graph view shows the whole vault as a network of linked notes.");
  await page.keyboard.press("Escape");

  // 7. Flow view.
  await sidebar.getByRole("button", { name: "Flow view" }).click();
  const flow = page.getByTestId("flow-view");
  await page.waitForTimeout(600);
  // Zooming about a point near the top keeps the first row in place and pulls the rest up into view.
  await page.mouse.move(WIDTH / 2, 110);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  await frame("7 · Flow view lays the same notes out top to bottom, following their links.");

  // 8. One branch at a time.
  const filter = page.getByRole("combobox", { name: "Filter by tag" });
  await filter.fill("mem");
  await filter.press("Enter");
  await filter.press("Escape");
  await page.mouse.move(WIDTH / 2, 110);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(300);
  await frame("8 · Filter the flow by tag to follow a single branch. Add more tags to widen it.");

  // 9. Arrange and edit in place.
  const card = page.getByTestId("flow-card").first();
  const handle = (await card.getByTestId("flow-card-handle").boundingBox())!;
  await page.mouse.move(handle.x + 30, handle.y + 8);
  await page.mouse.down();
  await page.mouse.move(handle.x + 300, handle.y + 60, { steps: 6 });
  await page.mouse.up();
  await card.locator(".cm-content").click();
  await frame("9 · Drag a card by its header, edit it in place, or change its type from the dropdown.");

  // 10. Settings.
  await flow.getByRole("button", { name: "Close" }).click();
  await sidebar.getByRole("button", { name: "Settings" }).click();
  await frame("10 · Settings holds the vault folder, the theme and light or dark mode.");

  mkdirSync(OUT_DIR, { recursive: true });
  const resized = await Promise.all(frames.map((png) => sharp(png).resize({ width: GIF_WIDTH }).png().toBuffer()));
  await sharp(resized, { join: { animated: true } })
    .gif({ delay: resized.map(() => SECONDS_PER_FRAME * 1000), loop: 0, effort: 10 })
    .toFile(path.join(OUT_DIR, "tour.gif"));
  // A still of the flow view, for places an animation doesn't suit.
  await sharp(frames[6]).resize({ width: GIF_WIDTH }).png().toFile(path.join(OUT_DIR, "flow-view.png"));
});
