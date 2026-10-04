# Review Triage Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review becomes the place where fleeting notes are sorted into permanent, literature or structure notes (or deleted), with in-place editing, on desktop and mobile.

**Architecture:** One new engine function, `listReviewInbox`, defines the inbox (non-deleted fleeting notes, oldest first) for both apps. Each app's Review screen is rewritten around an editable card and an action row; type changes and deletes go through the existing `updateNote` and `deleteNote`. The spaced-repetition engine code and note fields stay in place, unreachable from the UI.

**Tech Stack:** TypeScript, Vitest (engine and core unit tests), Next.js + React + CodeMirror in Electron (desktop), Playwright against a stubbed preload bridge (desktop e2e), Expo / React Native (mobile).

**Spec:** `docs/superpowers/specs/2026-10-04-review-triage-inbox-design.md`

## Global Constraints

- A note is in Review exactly when `type === "fleeting"` and it is not deleted. Nothing is stored on the note to mark it.
- Inbox order is `createdAt` ascending (oldest first).
- Type buttons offered: Permanent, Literature, Structure. Never `daily`, never `fleeting`.
- Spaced-repetition code stays: `addToReviewQueue`, `removeFromReviewQueue`, `listDueForReview`, `submitReview`, `srs.ts`'s `nextReviewState` and `addDays`, their tests, and the `reviewDue` / `reviewEase` / `reviewInterval` / `reviewReps` fields. No vault file is rewritten.
- User-facing Review strings come from `COPY` in `packages/core/src/copy.ts`; type labels come from `NOTE_TYPES` in `packages/themes`.
- Commit directly on `main`. No feature branch.
- Line endings: the repo checks out with CRLF (`core.autocrlf=true`). Use the editor's Edit tool, not scripts that rewrite whole files.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

Each line names the task whose tests pin it.

1. **A type button clicked twice quickly** must retype one note and advance once, not skip the next note. (Task 3, e2e "a double click on a type button sorts one note"; mobile uses the same `busy` guard, Task 4.)
2. **Closing Review within the save debounce** must not lose the last edit. (Task 3, e2e "Escape saves an edit still waiting to be written".)
3. **A failed type change** must leave the screen on the same note with a visible message, not advance. (Task 3, e2e "a failed type change stays on the note and says so".)
4. **The note open in the main editor being sorted or deleted in Review** must not leave the editor showing the old type or a deleted note. (Task 3, e2e "sorting the note that is open in the editor updates the editor".)
5. **An empty inbox** (no fleeting notes) must open to the caught-up state with no badge, not a blank card. (Task 3, e2e "with nothing fleeting, Review opens caught up".)

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `packages/local-engine/src/vault.ts` | Engine | Add `listReviewInbox`; `createNote` back to `reviewDue: null` |
| `packages/local-engine/src/srs.ts` | SM-2 maths | Remove `localToday` |
| `packages/local-engine/src/vault.test.ts` | Engine tests | Replace the "new notes" block with inbox tests |
| `packages/core/src/copy.ts` | Shared strings | Add Review strings |
| `apps/desktop/main.js`, `preload.js`, `src/lib/vaultClient.ts` | IPC bridge | Expose `listReviewInbox` |
| `apps/desktop/e2e/bridge.ts` | e2e stub | Add `listReviewInbox`; drop auto-queue |
| `apps/desktop/src/components/ReviewSession.tsx` | Review screen | Rewrite |
| `apps/desktop/src/app/page.tsx` | App shell | Rewire Review, remove queue button |
| `apps/desktop/e2e/review.e2e.ts` | e2e | New, replaces `spaced-repetition.e2e.ts` |
| `apps/mobile/src/lib/vault.ts` | Mobile engine binding | Expose `listReviewInbox` |
| `apps/mobile/src/app/review.tsx` | Review screen | Rewrite |
| `apps/mobile/src/app/(tabs)/index.tsx` | Vault tab | Badge and command text |
| `apps/mobile/src/app/vault/[id].tsx` | Note screen | Remove queue button |
| `docs/features/review.md`, `spaced-repetition.md`, `docs/ROADMAP.md` | Docs | New doc, status changes |

---

### Task 1: Engine — the inbox function, and undo auto-queueing

**Files:**
- Modify: `packages/local-engine/src/vault.ts` (`createNote` near line 240; review functions near line 633; srs import on line 5)
- Modify: `packages/local-engine/src/srs.ts` (end of file)
- Test: `packages/local-engine/src/vault.test.ts` (`describe("review queue")`, near line 520)

**Interfaces:**
- Consumes: existing `loadAllNotes(fs)`, `toListItem(note)`, `NoteListItem`, `FileSystemAdapter` in `vault.ts`.
- Produces: `export async function listReviewInbox(fs: FileSystemAdapter): Promise<NoteListItem[]>` — non-deleted notes with `type === "fleeting"`, `createdAt` ascending. Exported from the package root the same way `listDueForReview` is.

- [ ] **Step 1: Replace the auto-queue tests with inbox tests**

In `vault.test.ts`, add `listReviewInbox` to the import list from `"./vault"` (after `listDueForReview`). Inside `describe("review queue", ...)`, delete the whole `describe("new notes", () => { ... });` block (three tests, with its `beforeEach` / `afterEach`) and put this in its place:

```ts
    describe("the inbox", () => {
      // createdAt comes from the clock, and two notes made in the same
      // millisecond would have no order to assert on.
      beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-01T09:00:00Z"), toFake: ["Date"] }));
      afterEach(() => vi.useRealTimers());

      async function createLater(fs: ReturnType<typeof createMemoryFs>, input: Parameters<typeof createNote>[1]) {
        vi.advanceTimersByTime(60_000);
        return createNote(fs, input);
      }

      it("lists fleeting notes only, oldest first", async () => {
        const fs = createMemoryFs();
        const first = await createLater(fs, { title: "First thought", content: "" });
        await createLater(fs, { title: "Settled", content: "", type: "permanent" });
        const second = await createLater(fs, { title: "Second thought", content: "", type: "fleeting" });
        await createLater(fs, { title: "A book", content: "", type: "literature" });
        await createLater(fs, { title: "Index", content: "", type: "structure" });
        await getOrCreateDailyNote(fs, "2026-10-01");

        expect((await listReviewInbox(fs)).map((n) => n.id)).toEqual([first.id, second.id]);
      });

      it("keeps its order when an older note is edited", async () => {
        const fs = createMemoryFs();
        const first = await createLater(fs, { title: "First", content: "" });
        const second = await createLater(fs, { title: "Second", content: "" });
        vi.advanceTimersByTime(60_000);
        await updateNote(fs, { id: first.id, content: "edited later" });

        expect((await listReviewInbox(fs)).map((n) => n.id)).toEqual([first.id, second.id]);
      });

      it("drops a note once it is given another type, and takes one that becomes fleeting", async () => {
        const fs = createMemoryFs();
        const thought = await createLater(fs, { title: "Thought", content: "" });
        const settled = await createLater(fs, { title: "Settled", content: "", type: "permanent" });

        await updateNote(fs, { id: thought.id, type: "permanent" });
        expect(await listReviewInbox(fs)).toEqual([]);

        await updateNote(fs, { id: settled.id, type: "fleeting" });
        expect((await listReviewInbox(fs)).map((n) => n.id)).toEqual([settled.id]);
      });

      it("leaves out deleted notes", async () => {
        const fs = createMemoryFs();
        const thought = await createLater(fs, { title: "Thought", content: "" });
        await deleteNote(fs, thought.id);
        expect(await listReviewInbox(fs)).toEqual([]);
      });

      it("does not put a new note on the spaced-repetition schedule", async () => {
        const fs = createMemoryFs();
        expect((await createLater(fs, { title: "Thought", content: "" })).reviewDue).toBeNull();
      });
    });
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd packages/local-engine && npx vitest run src/vault.test.ts`
Expected: FAIL — `listReviewInbox` is not exported (import error), so the file fails to load.

- [ ] **Step 3: Implement `listReviewInbox` and undo auto-queueing**

In `vault.ts`, after `listDueForReview`, add:

```ts
// Review is where fleeting notes get sorted into what they should become.
// A note is in the inbox for exactly as long as it stays fleeting — no flag
// to set or clear. Oldest first, so the thought that has waited longest is
// dealt with first; createdAt rather than updatedAt, so editing a note
// doesn't send it to the back.
export async function listReviewInbox(fs: FileSystemAdapter): Promise<NoteListItem[]> {
  const notes = (await loadAllNotes(fs)).filter((n) => !n.deletedAt && n.type === "fleeting");
  return notes
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toListItem);
}
```

In `createNote`, remove the `const type = input.type ?? "fleeting";` line, put `type: input.type ?? "fleeting",` back in the object, and replace the four-line comment plus `reviewDue: type === "fleeting" ? localToday() : null,` with:

```ts
    reviewDue: null,
```

Change line 5 back to:

```ts
import { addDays, nextReviewState, type ReviewRating } from "./srs";
```

Restore the comment above `addToReviewQueue` to:

```ts
// Any note can be added to the review queue — restricting by type (e.g.
// permanent-only) would be arbitrary, since the queue is opt-in per note
// either way. Due immediately (today) so a freshly-added note shows up in
// the very next review session rather than waiting.
```

In `srs.ts`, delete the `localToday` function and its doc comment (the last block in the file).

- [ ] **Step 4: Run the engine tests and typecheck**

Run: `cd packages/local-engine && npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/local-engine/src/vault.ts packages/local-engine/src/srs.ts packages/local-engine/src/vault.test.ts
git commit -m "feat(engine): listReviewInbox for fleeting notes; stop auto-queueing new notes"
```

---

### Task 2: Shared Review strings

**Files:**
- Modify: `packages/core/src/copy.ts`

**Interfaces:**
- Produces, on `COPY`: `reviewTitle: string`, `reviewCommandDescription: string`, `reviewProgress: (current: number, total: number) => string`, `reviewSkip: string`, `reviewDelete: string`, `reviewCaughtUp: string`, `reviewActionFailed: string`, `reviewClose: string`. The delete confirmation reuses the existing `COPY.deleteNoteTitle` and `COPY.deleteNoteBody(title)`.

- [ ] **Step 1: Add the strings**

In `copy.ts`, before the closing `} as const;`, add:

```ts
  reviewTitle: "Review",
  reviewCommandDescription: "Sort your fleeting notes",
  reviewProgress: (current: number, total: number) => `${current} of ${total}`,
  reviewSkip: "Skip",
  reviewDelete: "Delete",
  reviewClose: "Close",
  reviewCaughtUp: "You're all caught up.",
  reviewActionFailed: "That didn't go through — the note is unchanged. Try again.",
```

- [ ] **Step 2: Typecheck and run core tests**

Run: `cd packages/core && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/copy.ts
git commit -m "feat(core): shared copy for the Review triage screen"
```

---

### Task 3: Desktop — Review as triage

**Files:**
- Modify: `apps/desktop/main.js` (after the `vault:listDueForReview` handler, near line 123)
- Modify: `apps/desktop/preload.js` (after `listDueForReview`)
- Modify: `apps/desktop/src/lib/vaultClient.ts` (`VaultBridge` and `vaultClient`)
- Modify: `apps/desktop/e2e/bridge.ts` (`createNote` and the review block)
- Rewrite: `apps/desktop/src/components/ReviewSession.tsx`
- Modify: `apps/desktop/src/app/page.tsx`
- Create: `apps/desktop/e2e/review.e2e.ts`
- Delete: `apps/desktop/e2e/spaced-repetition.e2e.ts`

**Interfaces:**
- Consumes: `listReviewInbox(fs)` (Task 1); `COPY.review*` (Task 2); existing `NoteEditor` (`compact`, `initialValue`, `onChange`, `onNavigateLink`, `onTagClick`, `noteTitles`, `tagNames`, `onExitUp`), `moveToEditorOnKey`, `ConfirmDialog`, `Button`, `NOTE_TYPES`, `NoteType` from `../lib/noteTypes`.
- Produces: `ReviewSession` props

```ts
interface ReviewSessionProps {
  note: { id: string; zettelId: string; title: string; content: string } | null;
  current: number;
  total: number;
  noteTitles: string[];
  tagNames: string[];
  onSave: (input: { id: string; title: string; content: string }) => Promise<void>;
  onSetType: (id: string, type: NoteType) => Promise<void>;
  onSkip: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}
```

The parent owns the queue and advancing; `onSetType`, `onSkip` and `onDelete` resolve once the next note is loaded, and reject if the vault call failed.

- [ ] **Step 1: Mirror the engine in the e2e stub**

In `e2e/bridge.ts`, in `createNote`, replace the three lines that compute `type` and `reviewDue` and push the note with the original single line:

```ts
          notes.push({ id, zettelId: String(notes.length + 1), title: input.title, content: input.content, type: input.type ?? "fleeting", tags: [] });
```

After the `listDueForReview` entry, add:

```ts
        // Like the engine: the inbox is every fleeting note, oldest first.
        // The array is in creation order already.
        listReviewInbox: async () =>
          notes.filter((n) => n.type === "fleeting").map(({ id, zettelId, title, type }) => ({ id, zettelId, title, type, updatedAt: stamp })),
```

- [ ] **Step 2: Write the failing e2e spec**

Delete `e2e/spaced-repetition.e2e.ts`. Create `e2e/review.e2e.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture (see bridge.ts): "Atomic Habits" is fleeting, "Systems" is
// permanent — so the inbox starts with one note.
const open = async (page: Page, seed?: Parameters<typeof stubBridge>[2]) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" }, seed);
  await page.goto("/");
};
const sidebar = (page: Page) => page.locator("aside").first();
const reviewButton = (page: Page) => sidebar(page).getByRole("button", { name: "Review" });
const count = (page: Page) => reviewButton(page).getByTestId("review-count");
const session = (page: Page) => page.getByTestId("review-session");
const title = (page: Page) => session(page).getByRole("textbox", { name: "Title" });

test("the badge counts fleeting notes and follows creates, sorting and deletes", async ({ page }) => {
  await open(page);
  await expect(count(page)).toHaveText("1");

  await sidebar(page).getByRole("button", { name: "New note" }).click();
  await expect(count(page)).toHaveText("2");

  await reviewButton(page).click();
  await expect(session(page).getByText("1 of 2")).toBeVisible();
  await expect(title(page)).toHaveValue("Atomic Habits");

  await session(page).getByRole("button", { name: "Permanent" }).click();
  await expect(session(page).getByText("2 of 2")).toBeVisible();
  await expect(title(page)).toHaveValue("Untitled");

  // Delete asks first.
  await session(page).getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this note?" });
  await expect(confirm).toContainText("Untitled");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(title(page)).toHaveValue("Untitled");
  await session(page).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this note?" }).getByRole("button", { name: "Delete" }).click();

  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  await expect(count(page)).toHaveCount(0);
  await expect(sidebar(page).getByText("2 notes")).toBeVisible();
});

test("each type button is offered, and Skip leaves the note fleeting", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  for (const name of ["Permanent", "Literature", "Structure", "Skip", "Delete"]) {
    await expect(session(page).getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(session(page).getByRole("button", { name: "Daily" })).toHaveCount(0);
  await expect(session(page).getByRole("button", { name: "Fleeting" })).toHaveCount(0);

  await session(page).getByRole("button", { name: "Skip" }).click();
  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  await expect(count(page)).toHaveText("1");
});

test("a note can be rewritten in place before it is sorted", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  await title(page).fill("Habits compound");
  const body = session(page).locator(".cm-content");
  await body.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Rewritten in review.");
  await session(page).getByRole("button", { name: "Literature" }).click();
  await session(page).getByRole("button", { name: "Close" }).last().click();

  await sidebar(page).getByRole("button", { name: /Habits compound/ }).first().click();
  await expect(page.locator("main .cm-content")).toContainText("Rewritten in review.");
});

test("Escape saves an edit still waiting to be written", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  await title(page).fill("Saved on the way out");
  await page.keyboard.press("Escape");
  await expect(session(page)).toHaveCount(0);
  await expect(sidebar(page).getByRole("button", { name: /Saved on the way out/ }).first()).toBeVisible();
});

test("a double click on a type button sorts one note", async ({ page }) => {
  await open(page, [
    { id: "a", zettelId: "1", title: "One", content: "", type: "fleeting", tags: [] },
    { id: "b", zettelId: "2", title: "Two", content: "", type: "fleeting", tags: [] },
    { id: "c", zettelId: "3", title: "Three", content: "", type: "fleeting", tags: [] },
  ]);
  await reviewButton(page).click();
  await session(page).getByRole("button", { name: "Permanent" }).dblclick();
  await expect(session(page).getByText("2 of 3")).toBeVisible();
  await expect(title(page)).toHaveValue("Two");
  await session(page).getByRole("button", { name: "Close" }).first().click();
  await expect(count(page)).toHaveText("2");
});

test("a failed type change stays on the note and says so", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  // The stub's types aren't visible to the spec files, hence the cast.
  await page.evaluate(() => {
    (window as unknown as { simplekasten: { vault: { updateNote: () => Promise<never> } } }).simplekasten.vault.updateNote = async () => {
      throw new Error("disk full");
    };
  });
  await session(page).getByRole("button", { name: "Permanent" }).click();
  await expect(session(page).getByRole("alert")).toContainText("That didn't go through");
  await expect(session(page).getByText("1 of 1")).toBeVisible();
  await expect(title(page)).toHaveValue("Atomic Habits");
});

test("sorting the note that is open in the editor updates the editor", async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole("button", { name: /Atomic Habits/ }).first().click();
  await reviewButton(page).click();
  await session(page).getByRole("button", { name: "Structure" }).click();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  // Structure notes are listed as Maps of Content.
  await expect(sidebar(page).getByText("Maps of content")).toBeVisible();
  await expect(count(page)).toHaveCount(0);
});

test("with nothing fleeting, Review opens caught up", async ({ page }) => {
  await open(page, [{ id: "b", zettelId: "1", title: "Systems", content: "", type: "permanent", tags: [] }]);
  await expect(count(page)).toHaveCount(0);
  await reviewButton(page).click();
  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test("the note header no longer has a review-queue button", async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole("button", { name: /Atomic Habits/ }).first().click();
  await expect(page.getByRole("button", { name: /review queue/i })).toHaveCount(0);
});
```

- [ ] **Step 3: Run the spec and see it fail**

Run: `cd apps/desktop && npx playwright test e2e/review.e2e.ts`
Expected: FAIL — every test, starting with `review-count` not found.

- [ ] **Step 4: Expose `listReviewInbox` through the bridge**

`main.js`, after the `vault:listDueForReview` handler:

```js
  ipcMain.handle("vault:listReviewInbox", () => localEngine.listReviewInbox(currentAdapter()));
```

`preload.js`, after `listDueForReview`:

```js
    listReviewInbox: () => ipcRenderer.invoke("vault:listReviewInbox"),
```

`vaultClient.ts`, in `VaultBridge` after `listDueForReview`:

```ts
  /** Fleeting notes waiting to be sorted, oldest first. */
  listReviewInbox: () => Promise<NoteListItem[]>;
```

and in `vaultClient` after `listDueForReview`:

```ts
  listReviewInbox: () => vault().listReviewInbox(),
```

- [ ] **Step 5: Rewrite `ReviewSession.tsx`**

Replace the whole file with:

```tsx
"use client";

import { COPY } from "@simplekasten/core";
import { useEffect, useRef, useState } from "react";
import { NOTE_TYPES, type NoteType } from "../lib/noteTypes";
import { CheckIcon, XIcon } from "./icons";
import { moveToEditorOnKey, NoteEditor } from "./NoteEditor";
import { Button, ConfirmDialog } from "./ui";

interface ReviewNote {
  id: string;
  zettelId: string;
  title: string;
  content: string;
}

interface ReviewSessionProps {
  note: ReviewNote | null;
  current: number;
  total: number;
  noteTitles: string[];
  tagNames: string[];
  onSave: (input: { id: string; title: string; content: string }) => Promise<void>;
  onSetType: (id: string, type: NoteType) => Promise<void>;
  onSkip: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const SAVE_DEBOUNCE_MS = 600;
// What a fleeting note can become. Not "daily": a journal entry belongs to a
// date and is made from Today. Not "fleeting": that is what Skip means.
const SORT_TYPES = NOTE_TYPES.filter((t) => t.value !== "fleeting" && t.value !== "daily");

// Review is where fleeting notes get sorted: read one, rewrite it if it needs
// it, and say what it is. Full screen for the same reason GraphView is — this
// is the primary activity for as long as it's open.
export function ReviewSession({ note, current, total, noteTitles, tagNames, onSave, onSetType, onSkip, onDelete, onClose }: ReviewSessionProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note?.title ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  // One action at a time: a second click before the next note arrives would
  // otherwise land on that note.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const textRef = useRef({ title: note?.title ?? "", content: note?.content ?? "" });
  const pendingRef = useRef<{ id: string; title: string; content: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmingRef = useRef(confirmingDelete);
  confirmingRef.current = confirmingDelete;

  // A new note arrived: the card shows its text, not the last one's.
  useEffect(() => {
    textRef.current = { title: note?.title ?? "", content: note?.content ?? "" };
    setTitle(note?.title ?? "");
    setFailed(false);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) await onSave(pending);
  }

  function edit(next: Partial<{ title: string; content: string }>) {
    if (!note) return;
    textRef.current = { ...textRef.current, ...next };
    pendingRef.current = { id: note.id, ...textRef.current };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush().catch(() => setFailed(true)), SAVE_DEBOUNCE_MS);
  }

  async function act(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await flush();
      await action();
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function close() {
    try {
      await flush();
    } catch {
      // The text is lost either way once the screen closes; closing is what was asked for.
    }
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape first dismisses whatever is open on top — the editor's
      // suggestion list (it marks that as handled) or the delete confirmation.
      if (e.defaultPrevented || confirmingRef.current) return;
      if (e.key === "Escape") void close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="review-session">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">{COPY.reviewTitle}</h2>
        <div className="flex items-center gap-3">
          {note && <span className="font-mono text-xs text-ink-faint">{COPY.reviewProgress(current, total)}</span>}
          <button
            onClick={() => void close()}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <XIcon />
            {COPY.reviewClose}
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-10 py-8">
        {note ? (
          <div className="w-full max-w-2xl">
            <div ref={cardRef} className="mb-4 flex h-[50vh] flex-col rounded-2xl border-(length:--border-w) border-line bg-surface p-8">
              <div className="mb-3 font-mono text-xs text-ink-faint">{note.zettelId}</div>
              <input
                aria-label="Title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  edit({ title: e.target.value });
                }}
                onKeyDown={(e) => moveToEditorOnKey(e, cardRef.current)}
                placeholder={COPY.titlePlaceholder}
                className="font-display mb-4 w-full border-none bg-transparent text-2xl font-bold text-ink outline-none"
              />
              <div className="min-h-0 flex-1">
                {/* Uncontrolled: keyed by note so each note mounts its own editor. */}
                <NoteEditor
                  key={note.id}
                  compact
                  initialValue={note.content}
                  onChange={(content) => edit({ content })}
                  onNavigateLink={() => {}}
                  onTagClick={() => {}}
                  noteTitles={noteTitles}
                  tagNames={tagNames}
                  onExitUp={() => cardRef.current?.querySelector<HTMLInputElement>("input")?.focus()}
                />
              </div>
            </div>
            {failed && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {COPY.reviewActionFailed}
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {SORT_TYPES.map((t) => (
                <Button key={t.value} variant={t.value === "permanent" ? "primary" : "secondary"} disabled={busy} onClick={() => act(() => onSetType(note.id, t.value))}>
                  {t.label}
                </Button>
              ))}
              <Button variant="ghost" disabled={busy} onClick={() => act(onSkip)}>
                {COPY.reviewSkip}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                {COPY.reviewDelete}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-faint">
              <CheckIcon width={26} height={26} />
            </div>
            <p className="text-sm text-ink-muted">{COPY.reviewCaughtUp}</p>
            <Button onClick={() => void close()}>{COPY.reviewClose}</Button>
          </div>
        )}
      </div>

      {confirmingDelete && note && (
        <ConfirmDialog
          title={COPY.deleteNoteTitle}
          body={COPY.deleteNoteBody(textRef.current.title)}
          confirmLabel={COPY.reviewDelete}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            // The note is going; an edit waiting to be saved must not land after it.
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
            pendingRef.current = null;
            void act(() => onDelete(note.id));
          }}
        />
      )}
    </div>
  );
}
```

Before relying on `text-danger`, confirm the class exists: run `grep -rn "text-danger" apps/desktop/src | head -3`. If nothing matches, find the class the `danger` Button variant uses for its text in `ui.tsx` (`grep -n "danger" apps/desktop/src/components/ui.tsx`) and use that class instead.

- [ ] **Step 6: Rewire `page.tsx`**

1. Remove `ReviewRating` from the type import near line 11.
2. Rename state `dueCount` / `setDueCount` to `reviewCount` / `setReviewCount`, and `refreshDueCount` to `refreshReviewCount`, everywhere in the file. Its body becomes:

```ts
  async function refreshReviewCount() {
    setReviewCount((await vaultClient.listReviewInbox()).length);
  }
```

3. Replace the comment above `reviewQueue` with:

```ts
  // Non-null while Review is open; holds the fleeting notes fetched when it
  // opened, so the "N of M" count stays put while notes are sorted out of it.
```

4. Delete `toggleReviewQueue` and `rateReviewNote`. Replace `openReview` and add the handlers below it (keep `closeReview` as is):

```ts
  async function openReview() {
    await flushPending();
    const inbox = await vaultClient.listReviewInbox();
    setReviewQueue(inbox);
    setReviewIndex(0);
    setReviewNote(inbox.length > 0 ? await loadNote(inbox[0].id) : null);
  }

  async function advanceReview() {
    if (!reviewQueue) return;
    const nextIndex = reviewIndex + 1;
    setReviewIndex(nextIndex);
    setReviewNote(nextIndex < reviewQueue.length ? await loadNote(reviewQueue[nextIndex].id) : null);
  }

  // What Review changes has to reach everything else showing the note: the
  // note list, the tag list, the badge, and the editor if it has it open.
  async function reloadSelectedIf(id: string) {
    if (selected?.id !== id) return;
    setSelected(await loadNote(id));
    setEditorNonce((n) => n + 1);
  }

  async function saveReviewNote(input: { id: string; title: string; content: string }) {
    await vaultClient.updateNote(input);
    refreshNotes(activeTag);
    refreshTags();
    await reloadSelectedIf(input.id);
  }

  async function setReviewNoteType(id: string, type: NoteType) {
    await vaultClient.updateNote({ id, type });
    refreshNotes(activeTag);
    refreshReviewCount();
    await reloadSelectedIf(id);
    await advanceReview();
  }

  async function deleteReviewNote(id: string) {
    await vaultClient.deleteNote(id);
    if (selected?.id === id) setSelected(null);
    refreshNotes(activeTag);
    refreshTags();
    refreshReviewCount();
    await advanceReview();
  }
```

5. The badge must follow type changes made outside Review. Add `refreshReviewCount();` in three places: at the end of `updateType` (after the `await save({...})`), in `saveNoteFromFlow` inside the existing `if (input.type !== undefined)` branch (make it a block: `{ refreshDailyNotes(); refreshReviewCount(); }`), and at the end of `deleteSelected` after `refreshTags();`.
6. In the command list, the `review` entry's description becomes `COPY.reviewCommandDescription`.
7. In the sidebar button, `data-testid="review-due-count"` becomes `data-testid="review-count"`.
8. Delete the whole `<IconButton aria-label={selected.reviewDue ? ...} ... onClick={toggleReviewQueue} ...><RepeatIcon /></IconButton>` element in the note header (near line 1113). It carried the `ml-2` spacing when there are no templates; move that to the next button by changing the Version history `IconButton` to `className={templates.length > 0 ? "" : "ml-2"}`. `RepeatIcon` is still used by the sidebar button, so its import stays.
9. Replace the `<ReviewSession ... />` element with:

```tsx
      {reviewQueue && (
        <ReviewSession
          note={reviewNote}
          current={Math.min(reviewIndex + 1, reviewQueue.length)}
          total={reviewQueue.length}
          noteTitles={notes.filter((n) => n.id !== reviewNote?.id).map((n) => n.title)}
          tagNames={tags.map((t) => t.name)}
          onSave={saveReviewNote}
          onSetType={setReviewNoteType}
          onSkip={advanceReview}
          onDelete={deleteReviewNote}
          onClose={closeReview}
        />
      )}
```

Check the tag list's variable and field names first: run `grep -n "tagNames=" apps/desktop/src/app/page.tsx` and pass `tagNames` exactly as the main `NoteEditor` call does.

- [ ] **Step 7: Typecheck, unit tests, full e2e**

Run: `cd apps/desktop && npx tsc --noEmit && npx vitest run && npx playwright test`
Expected: no type errors; all unit tests PASS; all e2e specs PASS, including the nine in `review.e2e.ts`. If `demo/tour.demo.ts` references "Add to review queue" (`grep -n "review" demo/tour.demo.ts`), update that step to open Review and click Permanent instead, then run `npm run demo` to confirm it still records.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): Review sorts fleeting notes into types, with in-place editing"
```

---

### Task 4: Mobile — Review as triage

**Files:**
- Modify: `apps/mobile/src/lib/vault.ts`
- Rewrite: `apps/mobile/src/app/review.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx` (`load` near line 61, command list near line 148)
- Modify: `apps/mobile/src/app/vault/[id].tsx` (`todayLocal` and `toggleReviewQueue` near lines 135-145, header button near line 168)

**Interfaces:**
- Consumes: `engine.listReviewInbox(fs)` (Task 1); `COPY.review*`, `COPY.deleteNoteTitle`, `COPY.deleteNoteBody`, `COPY.titlePlaceholder`, `COPY.editorPlaceholder` (Task 2 and existing); `Button`, `ErrorText`, `fontFamily`, `useDisplayText` from `@/components/ui`; `NOTE_TYPES` from `@simplekasten/themes`.
- Produces: `vault.listReviewInbox(): Promise<NoteListItem[]>`.

- [ ] **Step 1: Bind the engine function**

In `lib/vault.ts`, after `listDueForReview`:

```ts
  listReviewInbox: () => engine.listReviewInbox(fs),
```

- [ ] **Step 2: Rewrite `review.tsx`**

Replace the whole file with:

```tsx
import { COPY } from "@simplekasten/core";
import type { NoteDetail, NoteListItem } from "@simplekasten/local-engine";
import { NOTE_TYPES, type NoteTypeInfo } from "@simplekasten/themes";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, ErrorText, fontFamily, useDisplayText } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type NoteType = NoteTypeInfo["value"];

const MONO = fontFamily("mono");
const SAVE_DEBOUNCE_MS = 600;
// What a fleeting note can become. Not "daily": a journal entry belongs to a
// date and is made from Today. Not "fleeting": that is what Skip means.
const SORT_TYPES = NOTE_TYPES.filter((t) => t.value !== "fleeting" && t.value !== "daily");

// Pushed from the vault tab's Review button, not a tab itself. Review is
// where fleeting notes get sorted: read one, rewrite it if it needs it, and
// say what it is — matching desktop's ReviewSession.
export default function ReviewScreen() {
  const { colors, shape } = useTheme();
  const displayText = useDisplayText();
  const router = useRouter();
  const [queue, setQueue] = useState<NoteListItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [failed, setFailed] = useState(false);
  // One action at a time: a second tap before the next note arrives would
  // otherwise land on that note.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ id: string; title: string; content: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(next: NoteDetail | null) {
    setNote(next);
    setTitle(next?.title ?? "");
    setContent(next?.content ?? "");
    setFailed(false);
  }

  // The list is fetched once per visit, so "N of M" stays put while notes
  // are sorted out of it.
  useFocusEffect(
    useCallback(() => {
      vault.listReviewInbox().then(async (inbox) => {
        setQueue(inbox);
        setIndex(0);
        show(inbox.length > 0 ? await vault.getNoteById(inbox[0].id) : null);
      });
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) await vault.updateNote(pending);
  }

  // Leaving within the debounce would otherwise drop the last edit.
  useEffect(() => () => void flush().catch(() => {}), []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(next: { title: string; content: string }) {
    if (!note) return;
    pendingRef.current = { id: note.id, ...next };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush().catch(() => setFailed(true)), SAVE_DEBOUNCE_MS);
  }

  async function advance() {
    if (!queue) return;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    show(nextIndex < queue.length ? await vault.getNoteById(queue[nextIndex].id) : null);
  }

  async function act(action: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await flush();
      await action();
      await advance();
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!note) return;
    const id = note.id;
    Alert.alert(COPY.deleteNoteTitle, COPY.deleteNoteBody(title), [
      { text: "Cancel", style: "cancel" },
      {
        text: COPY.reviewDelete,
        style: "destructive",
        onPress: () => {
          // The note is going; an edit waiting to be saved must not land after it.
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          pendingRef.current = null;
          void act(() => vault.deleteNote(id));
        },
      },
    ]);
  }

  if (!queue) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {note ? (
        <>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: colors.inkFaint, marginBottom: 10 }}>
            {COPY.reviewProgress(Math.min(index + 1, queue.length), queue.length)}
          </Text>
          <View style={[styles.card, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint, marginBottom: 8 }}>{note.zettelId}</Text>
            <TextInput
              accessibilityLabel="Title"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                edit({ title: value, content });
              }}
              placeholder={COPY.titlePlaceholder}
              placeholderTextColor={colors.inkFaint}
              style={[styles.title, displayText, { color: colors.ink }]}
            />
            <TextInput
              accessibilityLabel="Note text"
              value={content}
              onChangeText={(value) => {
                setContent(value);
                edit({ title, content: value });
              }}
              placeholder={COPY.editorPlaceholder}
              placeholderTextColor={colors.inkFaint}
              multiline
              textAlignVertical="top"
              style={[styles.content, { color: colors.ink }]}
            />
          </View>
          {failed && <ErrorText>{COPY.reviewActionFailed}</ErrorText>}
          <View style={styles.actionRow}>
            {SORT_TYPES.map((t) => (
              <Button
                key={t.value}
                variant={t.value === "permanent" ? "primary" : "secondary"}
                label={t.label}
                disabled={busy}
                onPress={() => act(() => vault.updateNote({ id: note.id, type: t.value as NoteType }))}
                style={styles.actionButton}
              />
            ))}
            <Button label={COPY.reviewSkip} disabled={busy} onPress={() => act(async () => {})} style={styles.actionButton} />
            <Button variant="danger" label={COPY.reviewDelete} disabled={busy} onPress={confirmDelete} style={styles.actionButton} />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>{COPY.reviewCaughtUp}</Text>
          <Button label={COPY.reviewClose} onPress={() => router.back()} style={styles.closeButton} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 48 },
  card: { padding: 18, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, padding: 0 },
  content: { fontSize: 15, lineHeight: 22, minHeight: 160, padding: 0 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionButton: { flexBasis: "30%", flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  closeButton: { marginTop: 16 },
});
```

- [ ] **Step 3: Vault tab — badge and command text**

In `(tabs)/index.tsx`, in `load`, replace `vault.listDueForReview(new Date().toLocaleDateString("en-CA")),` with `vault.listReviewInbox(),`. Rename `due` to `inbox`, and `dueCount` / `setDueCount` to `reviewCount` / `setReviewCount` throughout the file. In the command list, the `review` entry's `description` becomes `COPY.reviewCommandDescription` (confirm `COPY` is imported: `grep -n 'import { COPY' "apps/mobile/src/app/(tabs)/index.tsx"`; add `import { COPY } from "@simplekasten/core";` if not).

- [ ] **Step 4: Note screen — remove the queue button**

In `vault/[id].tsx`, delete the `toggleReviewQueue` function and the `<IconButton icon="repeat" ... onPress={toggleReviewQueue} />` element in `headerRight`. Then run `grep -n "todayLocal" "apps/mobile/src/app/vault/[id].tsx"`; if the only remaining match is the function's own definition, delete that function and the comment above it too.

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual pass on the emulator**

Mobile has no automated UI tests. Start the Pixel_7a emulator and Expo Go (`adb reverse tcp:8081 tcp:8081`, then `npx expo start` in `apps/mobile`) and check each of these, recording the result of every line in the task report:

1. The vault tab's Review button shows `Review · N` where N is the number of fleeting notes; creating a note raises it by one after returning to the tab.
2. Review opens on the oldest fleeting note with "1 of N".
3. Editing the title and text, then tapping Literature, moves to the next note; opening the edited note from the vault tab shows the new text and the Literature badge.
4. Skip moves on and the note is still in Review on the next visit.
5. Delete asks first; Cancel keeps the note; Delete removes it and moves on.
6. Tapping Permanent twice quickly moves forward one note, not two.
7. Editing a title and pressing the back gesture straight away: the new title shows in the vault tab.
8. After the last note, "You're all caught up." and Close returns to the vault tab with no count on the button.
9. A note's header no longer has the review-queue (repeat) icon.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): Review sorts fleeting notes into types, with in-place editing"
```

---

### Task 5: Docs

**Files:**
- Create: `docs/features/review.md`
- Modify: `docs/features/spaced-repetition.md` (status line; the "Updated 2026-10-04" paragraph)
- Modify: `docs/ROADMAP.md` (the "What Simplekasten already has" paragraph; gap table row 3; Status table)

**Interfaces:** none.

- [ ] **Step 1: Write `docs/features/review.md`**

```markdown
# Feature: Review (triage inbox)

**Status:** shipped 2026-10-04, desktop and mobile.
**Spec:** `docs/superpowers/specs/2026-10-04-review-triage-inbox-design.md`

**Why:** a fleeting note is a thought still to be worked out. Left alone it
is only ever seen again by luck. Review is the standing place to go through
them: read one, rewrite it if it needs it, and say what it is.

## The rule

A note is in Review exactly when its type is `fleeting` and it is not
deleted. Nothing is stored on the note to mark it; giving it another type or
deleting it is what takes it out. `listReviewInbox(fs)` in
`packages/local-engine/src/vault.ts` is the one definition, and returns the
notes oldest first by creation time.

## The screen

One note at a time, with an "N of M" counter fixed when the screen opened.
The title and text are editable in place and save on a short debounce, and
before any action or close.

| Action | Effect |
|---|---|
| Permanent / Literature / Structure | Sets the type, moves to the next note |
| Skip | Moves on; the note stays fleeting and returns next time |
| Delete | Asks first, deletes, moves on |

`daily` is not offered: a journal entry belongs to a date and is made from
Today. The Review button's badge is the number of fleeting notes.

## What it replaced

Until 2026-10-04 Review was a spaced-repetition drill (Again / Hard / Good /
Easy). That is a different feature, Flashcards, and is parked: see
`spaced-repetition.md`.

## Tests

Engine: `describe("the inbox")` in `vault.test.ts`. Desktop:
`apps/desktop/e2e/review.e2e.ts`. Mobile: typecheck plus the manual
checklist in the implementation plan.
```

- [ ] **Step 2: Park the spaced-repetition doc**

In `spaced-repetition.md`, replace the `**Status:** shipped 2026-09-23.` line with:

```markdown
**Status:** parked 2026-10-04. The engine code and note fields described
here are still in the repo, but no screen reaches them: Review now sorts
fleeting notes (`review.md`). This will return, redesigned, as Flashcards.
```

Delete the paragraph that begins `**Updated 2026-10-04:** a new \`fleeting\` note is queued automatically` through the end of that paragraph, and restore the sentence before it to end `...and the queue is opt-in per note either way, so there's no "type" gate to design around.`

- [ ] **Step 3: Update the roadmap**

In `ROADMAP.md`:
- In the Status table, change the `Spaced repetition` row's last cell to `Parked 2026-10-04 (to return as Flashcards)` and add a row below it: `| Review (triage inbox) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 2026-10-04 |`.
- In the gap table, add a row after #14: `| 15 | **Flashcards** (spaced repetition over chosen notes) | RemNote, Anki, Obsidian plugin | Medium — the SM-2 engine code already exists (parked) | Medium — needs its own design: what becomes a card, and where it lives |`.
- In "What Simplekasten already has", add after the daily-notes mention: ` · Review: a triage inbox that sorts fleeting notes into permanent, literature or structure notes, on both platforms`. If that paragraph has no daily-notes mention, append it before `· dark mode`.

- [ ] **Step 4: Commit**

```bash
git add docs/features/review.md docs/features/spaced-repetition.md docs/ROADMAP.md
git commit -m "docs: Review is a triage inbox; spaced repetition parked for Flashcards"
```

---

### Final check

- [ ] Run from the repo root: `npm run typecheck && npm run test`, then `cd apps/desktop && npx playwright test`.
Expected: clean typecheck across all workspaces, all unit tests PASS, all e2e specs PASS.
