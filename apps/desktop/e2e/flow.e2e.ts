import { expect, test, type Locator } from "@playwright/test";
import { stubBridge } from "./bridge";

// Where one card sits relative to another — unaffected by the view re-centring
// itself when the flow is reopened.
const offset = async (card: Locator, anchor: Locator) => {
  const a = (await card.boundingBox())!;
  const b = (await anchor.boundingBox())!;
  return { x: Math.round(a.x - b.x), y: Math.round(a.y - b.y) };
};

// Fixture: "Systems" links to "Atomic Habits", so the flow has two cards and one arrow.
test("cards can be dragged, stay where they were put, and Auto-arrange resets them", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const card = page.getByTestId("flow-card").first();
  const other = page.getByTestId("flow-card").last();
  const autoArrange = page.getByRole("button", { name: "Auto-arrange" });
  await expect(page.getByTestId("flow-edge")).toHaveCount(1);
  await expect(autoArrange).toBeDisabled();
  const start = await offset(card, other);
  const arrowBefore = await page.getByTestId("flow-edge").getAttribute("d");

  // Drag by the header strip.
  const handle = (await card.getByTestId("flow-card-handle").boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 240, handle.y + handle.height / 2 + 90, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => offset(card, other)).toEqual({ x: start.x + 200, y: start.y + 90 });
  // The arrow follows the card.
  expect(await page.getByTestId("flow-edge").getAttribute("d")).not.toBe(arrowBefore);

  // Closing and reopening keeps the arrangement.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Flow view" }).click();
  await expect.poll(() => offset(card, other)).toEqual({ x: start.x + 200, y: start.y + 90 });

  await autoArrange.click();
  await expect.poll(() => offset(card, other)).toEqual(start);
  await expect(autoArrange).toBeDisabled();
});

// Fixture tags: "Atomic Habits" has #habits, "Systems" has method; a daily note always carries journalentry.
test("the tag search narrows the flow to notes carrying any chosen tag", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.locator("aside").first().getByText("3 notes")).toBeVisible();
  await page.getByRole("button", { name: "Flow view" }).click();

  const cards = page.getByTestId("flow-card");
  const edges = page.getByTestId("flow-edge");
  const filter = page.getByRole("combobox", { name: "Filter by tag" });
  const options = page.getByRole("listbox").getByRole("option");
  await expect(cards).toHaveCount(3);

  // Focusing lists every tag, including the built-in one on the daily note.
  await filter.click();
  await expect(options).toHaveText(["#habits1", "#journalentry1", "#method1"]);

  await filter.fill("hab");
  await expect(options).toHaveCount(1);
  await filter.press("Enter");
  await expect(cards).toHaveCount(1);
  await expect(edges).toHaveCount(0);
  await expect(page.getByTestId("flow-filter-count")).toHaveText("1 of 3");

  // A second tag widens the flow: either tag is enough, and the link between the two notes returns.
  await filter.fill("meth");
  await filter.press("Enter");
  await expect(cards).toHaveCount(2);
  await expect(edges).toHaveCount(1);

  await options.filter({ hasText: "journalentry" }).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByTestId("flow-filter-chip")).toHaveCount(3);

  // Escape in the search box leaves the flow view open.
  await filter.press("Escape");
  await expect(page.getByTestId("flow-view")).toBeVisible();

  await page.getByRole("button", { name: "Remove #habits" }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("flow-filter-chip")).toHaveCount(0);
  await expect(cards).toHaveCount(3);
});

test("notes can be edited with link and tag suggestions, created and deleted from the flow", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const flow = page.getByTestId("flow-view");
  const cards = page.getByTestId("flow-card");
  const edges = page.getByTestId("flow-edge");
  const suggestions = page.locator(".cm-tooltip-autocomplete");
  await expect(cards).toHaveCount(2);
  await expect(edges).toHaveCount(1);

  // Update: typing [[ suggests note titles; the new link becomes an arrow once saved.
  const body = cards.first().locator(".cm-content");
  await expect(body).toContainText("Small changes compound.");
  await body.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" [[Sys");
  await expect(suggestions).toContainText("Systems");
  // CodeMirror ignores Enter for a moment after the list appears, so a fast typist doesn't accept by accident.
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await expect(body).toContainText("[[Systems]]");
  await expect(edges).toHaveCount(2);

  // Typing # suggests existing tags, and the saved tag reaches the filter without reopening the view.
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" #me");
  await expect(suggestions).toContainText("method");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await expect(body).toContainText("#method");
  await page.getByRole("combobox", { name: "Filter by tag" }).click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveText(["#habits1", "#method2"]);
  await page.keyboard.press("Escape");
  await expect(flow).toBeVisible();

  // Create: a new card appears with its title ready to type over.
  await flow.getByRole("button", { name: "New note" }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.last().locator("input")).toBeFocused();
  await page.keyboard.type("Fresh idea");
  await expect(cards.last().locator("input")).toHaveValue("Fresh idea");

  // Delete: asks first, then removes the card.
  await cards.last().getByRole("button", { name: "Delete note" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this note?" });
  await expect(confirm).toContainText("Fresh idea");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(cards).toHaveCount(2);

  // Everything done in the flow shows in the main view too.
  await flow.getByRole("button", { name: "Close" }).click();
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("2 notes")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "#method 2" })).toBeVisible();
});

test("only a card's header is a drag handle; its text shows a text cursor and a caret visible on the dark theme", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const card = page.getByTestId("flow-card").first();
  const cursorOf = (selector: string) => card.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor);
  await expect(card.locator(".cm-content")).toBeVisible();
  expect(await cursorOf("[data-testid=flow-card-handle]")).toBe("grab");
  expect(await cursorOf("[data-testid=flow-card-body]")).toBe("default");
  expect(await cursorOf(".cm-content")).toBe("text");

  // The caret is drawn in the theme's ink colour (#f1f5f9 in Classic dark), not CodeMirror's default black.
  await card.locator(".cm-content").click();
  const caret = card.locator(".cm-cursor").first();
  await expect(caret).toBeAttached();
  expect(await caret.evaluate((el) => getComputedStyle(el).borderLeftColor)).toBe("rgb(241, 245, 249)");
});

test("journal entries are tagged and marked in the flow, and can be hidden or shown on their own", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.locator("aside").first().getByText("3 notes")).toBeVisible();
  // The journal tag is on the note without anyone assigning it, and shows in the sidebar's tag list.
  await expect(page.locator("aside").first().getByRole("button", { name: "#journalentry 1" })).toBeVisible();
  await page.getByRole("button", { name: "Flow view" }).click();

  const cards = page.getByTestId("flow-card");
  const toggle = page.getByTestId("flow-journal-toggle");
  await expect(cards).toHaveCount(3);
  // Exactly the daily note's card carries the Journal mark.
  await expect(page.getByTestId("flow-journal-badge")).toHaveCount(1);
  await expect(toggle).toHaveText("Journal 1");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Hide journal entries, leaving the rest of the flow.
  await toggle.click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("flow-journal-badge")).toHaveCount(0);
  await expect(page.getByTestId("flow-filter-count")).toHaveText("2 of 3");

  // Asking for the journal tag shows only journal entries, and un-hides them.
  const filter = page.getByRole("combobox", { name: "Filter by tag" });
  await filter.fill("journal");
  await filter.press("Enter");
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId("flow-journal-badge")).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // A note with no tag at all is offered as Untagged.
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByTestId("flow-view").getByRole("button", { name: "New note" }).click();
  await expect(cards).toHaveCount(4);
  await filter.click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveText(["#habits1", "#journalentry1", "#method1", "Untagged1"]);
});

test("a card's type dropdown changes the note's type, and the rest of the app follows", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  // "Atomic Habits" is the open note in the main view and starts as fleeting.
  const card = page.getByTestId("flow-card").first();
  const type = card.getByRole("combobox", { name: "Note type" });
  await expect(type).toHaveValue("fleeting");
  const borderBefore = await card.evaluate((el) => getComputedStyle(el).borderTopColor);

  await type.selectOption("permanent");
  await expect(type).toHaveValue("permanent");
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(borderBefore);

  // Making it a daily note marks it as a journal entry and gives it the journal tag.
  await type.selectOption("daily");
  await expect(card.getByTestId("flow-journal-badge")).toBeVisible();
  await expect(page.getByTestId("flow-journal-toggle")).toHaveText("Journal 1");
  await page.screenshot({ path: "C:/Users/Sunil/AppData/Local/Temp/claude/c--Users-Sunil-Documents-ClaudeProjects-Simplekasten/fc5d1b8d-9c75-47ed-b57c-4a121b8a8e28/scratchpad/flow-type.png" });

  await page.getByTestId("flow-view").getByRole("button", { name: "Close" }).click();
  await expect(page.locator("main select").first()).toHaveValue("daily");
  await expect(page.locator("aside").first().getByRole("button", { name: "#journalentry 1" })).toBeVisible();
});

test("Down from a card's title moves into its text, and Up from the first line moves back", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const card = page.getByTestId("flow-card").first();
  const title = card.locator("input");
  const body = card.locator(".cm-content");
  await expect(body).toContainText("Small changes compound.");

  await title.click();
  await page.keyboard.press("ArrowDown");
  await expect(body).toBeFocused();
  await page.keyboard.type("X");
  await expect(body).toContainText("XSmall changes compound.");

  await page.keyboard.press("ArrowUp");
  await expect(title).toBeFocused();

  // Enter in the title does the same as Down.
  await page.keyboard.press("Enter");
  await expect(body).toBeFocused();
  await expect(title).toHaveValue("Atomic Habits");
});

test("Ctrl+click on a link to a note that doesn't exist makes it on the flow, carrying the card's tags", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" }, [
    // One tag typed as a #hashtag, one assigned — both belong to the card.
    { id: "a", zettelId: "1", title: "Linking Over Filing", content: "Connections matter. #method\n\n[[Test Method]]", type: "permanent", tags: ["zettel"] },
    { id: "b", zettelId: "2", title: "Plain", content: "Leads to [[No Tags Note]].", type: "fleeting", tags: [] },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const flow = page.getByTestId("flow-view");
  const cards = page.getByTestId("flow-card");
  const edges = page.getByTestId("flow-edge");
  const cardTitled = (title: string) => page.locator(`[data-testid="flow-card"]:has(input[value="${title}"])`);
  await expect(cards).toHaveCount(2);
  await expect(edges).toHaveCount(0);

  // Narrow to #method first: the new card must still show, since it shares the tag.
  const filter = page.getByRole("combobox", { name: "Filter by tag" });
  await filter.fill("meth");
  await filter.press("Enter");
  await expect(cards).toHaveCount(1);

  await cards.first().locator(".cm-wikilink").click({ modifiers: ["ControlOrMeta"] });
  await expect(flow).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(edges).toHaveCount(1);
  const created = cardTitled("Test Method");
  await expect(created.locator(".cm-content")).toHaveText("#method #zettel");

  await filter.press("Backspace");
  await expect(cards).toHaveCount(3);

  // A card with no tags still gets its linked note — just an empty one.
  await cardTitled("Plain").locator(".cm-wikilink").click({ modifiers: ["ControlOrMeta"] });
  await expect(cards).toHaveCount(4);
  await expect(edges).toHaveCount(2);
  await expect(cardTitled("No Tags Note").locator(".cm-placeholder")).toBeVisible();

  await flow.getByRole("button", { name: "Close" }).click();
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("4 notes")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "#method 2" })).toBeVisible();
});
