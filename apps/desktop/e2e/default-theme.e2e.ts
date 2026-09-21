import { expect, test, type Page } from "@playwright/test";
import { stubBridge } from "./bridge";

// Palette: purple #672394, pink #f725a0, yellow #fad141, teal #0cb2c0, cream #e8e6d9
// — plus the tints/shades Memphis derives from them (see packages/themes).
const cssVar = (name: string) => `getComputedStyle(document.documentElement).getPropertyValue("${name}").trim()`;

/** Every colour the Memphis theme defines for a mode, as "r,g,b" strings. */
async function paletteOf(page: Page): Promise<Set<string>> {
  const values = await page.evaluate(() =>
    [
      "bg", "surface", "surface-2", "ink", "ink-muted", "ink-faint", "line", "line-soft",
      "accent", "accent-ink", "accent-soft", "accent-2", "accent-2-soft", "danger", "danger-soft",
    ].map((n) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${n}`).trim()),
  );
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
  return new Set([...values.map(rgb), "255,255,255"]); // white = text on the pink primary button
}

/** Every distinct non-transparent colour actually painted on the page, as "r,g,b". */
async function paintedColors(page: Page): Promise<Map<string, string>> {
  // Sample settled colours, not mid-transition ones.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  const found = await page.evaluate(() => {
    const out = new Map<string, string>();
    const probe = document.createElement("canvas").getContext("2d")!;
    const toRgb = (value: string): string | null => {
      if (!value || value === "transparent" || /,\s*0\)$/.test(value)) return null; // fully transparent
      probe.fillStyle = "#000";
      probe.fillStyle = value;
      const hex = probe.fillStyle; // normalised to #rrggbb, or rgba(...) when translucent
      if (hex.startsWith("#")) return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
      const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? `${m[1]},${m[2]},${m[3]}` : null;
    };
    for (const el of document.querySelectorAll("body, body *")) {
      if (el.closest("nextjs-portal")) continue; // Next dev overlay, absent from the built app
      if (el.closest("[aria-hidden=true]")) continue; // decorative, e.g. swatches previewing other themes
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      for (const prop of ["color", "backgroundColor", "borderTopColor", "borderLeftColor"] as const) {
        const border = prop.startsWith("border");
        if (border && parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.borderLeftWidth) === 0) continue;
        const c = toRgb(cs[prop]);
        if (c && !out.has(c)) out.set(c, `${prop} on <${el.tagName.toLowerCase()} class="${String(el.getAttribute("class") ?? "").slice(0, 70)}">`);
      }
    }
    return [...out.entries()];
  });
  return new Map(found);
}

test("with nothing saved and no JavaScript, first paint is already Memphis (no slate flash)", async ({ browser }) => {
  for (const [scheme, bg] of [["light", "rgb(232, 230, 217)"], ["dark", "rgb(29, 10, 46)"]] as const) {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: scheme });
    const page = await context.newPage();
    await page.goto("/");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--border-w").trim())).toBe("3px");
    await context.close();
  }
});

test("Memphis is the default theme when the app has no saved settings", async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "system" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("radio", { name: /memphis/i })).toBeChecked();
  await expect(page.getByRole("radio", { name: /classic/i })).not.toBeChecked();
});

for (const mode of ["light", "dark"] as const) {
  test(`every colour on screen comes from the Memphis palette (${mode})`, async ({ page }) => {
    await stubBridge(page, { theme: "memphis", themeMode: mode });
    await page.goto("/");
    await page.getByRole("button", { name: /Atomic Habits/ }).first().click();
    await expect(page.getByText(/Linked mentions \(1\)/i)).toBeVisible();

    const palette = await paletteOf(page);
    const check = async (label: string) => {
      const stray = [...(await paintedColors(page))].filter(([c]) => !palette.has(c)).map(([c, where]) => `${c} ${where}`);
      expect(stray, `colours outside the palette in ${label}`).toEqual([]);
    };

    await check("main view");

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await check("settings modal"); // includes the ink-tinted backdrop
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Jump to/ }).click();
    await expect(page.getByPlaceholder(/Search notes/)).toBeVisible();
    await check("quick switcher");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Graph view" }).click();
    await expect(page.getByTestId("graph-view")).toBeVisible();
    await check("graph view");
  });
}

test("graph legend dots use theme colours, not the old slate/emerald map", async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Graph view" }).click();
  const dots = await page.getByTestId("graph-view").locator("span.rounded-full").evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).backgroundColor),
  );
  expect(dots.length).toBeGreaterThan(0);
  for (const dot of dots) expect(["rgb(148, 163, 184)", "rgb(5, 150, 105)", "rgb(180, 83, 9)", "rgb(71, 85, 105)"]).not.toContain(dot);
  expect(dots).toContain("rgb(8, 112, 124)"); // fleeting → accent2
});

test("Classic is still available and switches the shape back", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await expect.poll(() => page.evaluate(cssVar("--color-accent"))).toBe("#059669");
  expect(await page.evaluate(cssVar("--border-w"))).toBe("1px");
  await expect(page.locator("html")).not.toHaveAttribute("data-hard-shadow");
});
