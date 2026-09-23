# Feature: Spaced Repetition (review queue)

**Status:** shipped 2026-09-23.
**Why:** the actual point of a slip-box is resurfacing old notes at the
moment they're useful — Luhmann's system worked because he kept walking
the archive, not just adding to it. Every mature PKM tool now has some
form of this: Obsidian's spaced-repetition plugin is its most-installed
plugin category; RemNote builds it in natively. `DEVELOPMENT_PLAN.md`
already called this out as a nice-to-have ("Spaced-review resurfacing of
old permanent notes"). Pairs with nothing else already shipped — it's an
independent capability, unlike Daily Notes/Templates which fed each other.

## Scope decision

Any note can be added to the review queue — not just `permanent` notes.
Restricting by type would be arbitrary (a `literature` note or a
`structure` MoC can just as easily be worth resurfacing) and the queue is
opt-in per note either way, so there's no "type" gate to design around.

## Algorithm

A simplified SM-2 (the same family Anki and Obsidian's spaced-repetition
plugin use), with four ratings instead of SM-2's original 0-5 quality
score — matches the interaction every flashcard app already trained users
on:

```ts
export type ReviewRating = "again" | "hard" | "good" | "easy";

interface ReviewOutcome { ease: number; interval: number; reps: number }

function nextReviewState(current: { ease: number; interval: number; reps: number }, rating: ReviewRating): ReviewOutcome {
  if (rating === "again") {
    return { ease: Math.max(1.3, current.ease - 0.2), interval: 1, reps: 0 };
  }
  let ease = current.ease;
  if (rating === "hard") ease = Math.max(1.3, ease - 0.15);
  else if (rating === "easy") ease += 0.15;
  // "good" leaves ease unchanged — this is SM-2's actual behavior, not a simplification.

  let interval = current.reps === 0 ? 1 : current.reps === 1 ? 6 : Math.round(current.interval * ease);
  if (rating === "hard") interval = Math.max(1, Math.round(interval * 0.8));
  if (rating === "easy") interval = Math.round(interval * 1.3);

  return { ease, interval, reps: current.reps + 1 };
}
```

Starting state when a note is added to the queue: `ease: 2.5, interval: 0,
reps: 0`, due immediately (today) — so a freshly-added note shows up in
the very next review session rather than waiting.

## Data model (`packages/local-engine`)

Review state lives in the note's own frontmatter — four flat fields,
matching how `noteDate` and `attachmentIds` are already stored (no nested
YAML object, to keep `note-file.ts`'s parse/serialize symmetric with every
other field):

```ts
// packages/local-engine/src/types.ts — VaultNote gains:
reviewDue: string | null;   // "YYYY-MM-DD"; presence means "in the review queue" — this is the one field that gates everything else
reviewEase: number;         // SM-2 ease factor; meaningless while reviewDue is null
reviewInterval: number;     // days until the next due date, from the last review
reviewReps: number;         // consecutive successful (non-"again") reviews
```

Defaults for a note never added to the queue: `reviewDue: null, reviewEase:
2.5, reviewInterval: 0, reviewReps: 0`. `note-file.ts` omits all four keys
from frontmatter when `reviewDue` is null (same "omit when not applicable"
rule `deletedAt`/`attachmentIds` already follow), so ordinary notes' files
are untouched.

## `packages/local-engine/src/vault.ts` — new functions

```ts
export async function addToReviewQueue(fs: FileSystemAdapter, noteId: string): Promise<VaultNote>
// sets reviewDue = today (client-local date, passed by the caller — see
// Daily Notes' precedent for why this can't be computed server-side),
// reviewEase = 2.5, reviewInterval = 0, reviewReps = 0

export async function removeFromReviewQueue(fs: FileSystemAdapter, noteId: string): Promise<VaultNote>
// resets all four fields to their defaults — re-adding later starts fresh,
// not from wherever progress left off; simplest correct behavior for v1

export async function listDueForReview(fs: FileSystemAdapter, date: string): Promise<NoteListItem[]>
// reviewDue !== null && reviewDue <= date, oldest-due-first

export async function submitReview(fs: FileSystemAdapter, input: { noteId: string; rating: ReviewRating; today: string }): Promise<VaultNote>
// runs nextReviewState, writes reviewEase/interval/reps and the new
// reviewDue (today + interval days), returns the updated note
```

`date`/`today` inputs follow the exact convention Daily Notes established:
client-local `YYYY-MM-DD`, computed with `new Date().toLocaleDateString("en-CA")`.

## Desktop UI (`apps/desktop`)

- IPC (`main.js`/`preload.js`/`vaultClient.ts`) gains the four calls.
- Sidebar: a "Review" button (new `repeat` icon in `packages/core/src/icons.ts`)
  showing a due count badge when non-zero (e.g. "Review · 3"), same button
  pattern as "Today"/"Graph view". Clicking opens a full-screen review
  session, the same full-screen overlay pattern `GraphView` already
  establishes (not a modal — a review session is the primary activity for
  as long as it's open, same reasoning graph view gets a whole screen
  instead of a dialog).
- Review session (`components/ReviewSession.tsx`, new): shows the current
  due note's title and content read-only (no editor — reviewing isn't
  editing), four rating buttons (Again/Hard/Good/Easy) styled as a
  `SegmentedControl`-adjacent button row, and a progress indicator ("2 of
  5"). Rating a note calls `submitReview` then advances to the next due
  note, or shows a "You're all caught up" end state when the queue empties.
- Note header: a toggle `IconButton` (the same `repeat` icon, filled/active
  state when the note is in the queue) — "Add to review queue" /
  "Remove from review queue" depending on current state, next to the
  existing template/attach/delete buttons.

## Mobile UI (`apps/mobile`)

- `src/lib/vault.ts` gains the same four calls.
- Vault tab: a "Review" button next to "Today", showing the due count the
  same way.
- A new screen (`app/review.tsx`) — not a tab, pushed from the vault
  screen's Review button — presents one due note at a time (title +
  read-only content, matching desktop's read-only review presentation)
  with the same four rating buttons, advancing through the queue the same
  way.
- Note screen: a toggle icon in the header, same as desktop.

## Testing plan

- `packages/local-engine`: unit tests for `nextReviewState` covering all
  four ratings at reps 0/1/2+ (the boundary where interval math changes
  shape), `addToReviewQueue`/`removeFromReviewQueue`'s field resets,
  `listDueForReview`'s date filtering and ordering, and `submitReview`'s
  end-to-end write (ease/interval/reps/due all update correctly) — same
  style as `vault.test.ts`'s existing daily-notes/templates describe blocks.
- `apps/desktop`: extend `e2e/bridge.ts`'s stub with the four calls plus
  fixture notes with review state; add a spec covering add-to-queue,
  a full review session (rate through 2+ notes, verify the due count drops
  and the "all caught up" end state appears), and remove-from-queue.
- `apps/mobile`: `tsc` typecheck, then a visual smoke test through Expo's
  web target for the UI layer (same platform-limit caveat as Daily Notes
  and Templates — real interaction needs a device/emulator).

## Where this left off

Shipped 2026-09-23. All layers built and verified:

- **local-engine**: `srs.ts` (pure SM-2, 12 unit tests), the four frontmatter
  fields wired through `types.ts`/`note-file.ts` (round-trip tests updated,
  6/6 passing), and `addToReviewQueue`/`removeFromReviewQueue`/
  `listDueForReview`/`submitReview` in `vault.ts` (7 new tests in a "review
  queue" describe block, part of `vault.test.ts`'s 36 total). One deviation
  from the original signature sketch: `addToReviewQueue(fs, noteId, today)`
  takes `today` as a parameter (not computed engine-side), consistent with
  the client-local-date convention everywhere else in this engine.
- **Desktop**: IPC wired end-to-end (`main.js`/`preload.js`/`vaultClient.ts`),
  `repeat`/`check` icons added to `packages/core/src/icons.ts`, a sidebar
  "Review" button with a due-count badge (`data-testid="review-due-count"`),
  a full-screen `ReviewSession.tsx` (Again/Hard/Good/Easy, progress
  indicator, all-caught-up end state), and a note-header toggle icon.
  `e2e/bridge.ts`'s stub extended; `spaced-repetition.e2e.ts` covers both
  the toggle and a full rate-through-the-queue session — all 20 desktop e2e
  specs pass.
- **Mobile**: `src/lib/vault.ts` gained the same four calls, the vault tab
  has a "Review" button (due count inline, e.g. "Review · 3") next to
  "Today", a new `app/review.tsx` screen (registered in `_layout.tsx`,
  pushed rather than a tab) presents due notes one at a time with the same
  rating buttons and end state, and the note screen's header gained the same
  toggle icon. Verified via `tsc` (clean) and a visual smoke test through
  Expo's web target — the vault tab renders correctly; the review screen's
  actual due-list fetch hits the same documented `expo-file-system`
  web-target limitation Daily Notes and Templates already hit
  (`makeDirectoryAsync` isn't available on web), so real interaction is
  unverified outside a device/emulator, as expected for this platform.

Full-suite final check: 146 unit tests (desktop 28, core 19, local-engine
67, themes 32) + 20 desktop e2e tests, all green; `tsc --noEmit` clean
across all five workspaces.
