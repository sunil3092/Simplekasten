# Review as a triage inbox

**Date:** 2026-10-04
**Status:** Draft, awaiting review

## Goal

Review stops being a flashcard drill and becomes the place where fleeting
notes are sorted. It shows each fleeting note in turn; the user rewrites it
if needed and decides what it becomes: permanent, literature, structure, or
nothing (delete). Desktop and mobile behave the same.

The screen Review shows today (one note, rated Again / Hard / Good / Easy on
a spaced schedule) is a different feature, Flashcards. It is hidden by this
change and designed separately later.

## Decisions

- **Inbox rule: every fleeting note.** A note is in Review exactly when its
  type is `fleeting` and it is not deleted. Nothing is stored on the note to
  mark it. Fleeting notes already in the vault appear too.
- **Order: oldest first**, by creation time, so the longest-waiting thought
  is dealt with first.
- **Actions: pick a type, skip, delete, edit in place.** Detailed below.
- **Flashcards is hidden, not removed.** The spaced-repetition engine code
  and the `reviewDue` / `reviewEase` / `reviewInterval` / `reviewReps`
  fields stay as they are. No UI reaches them. No vault file is rewritten.
- **Both apps in one piece of work.** Features stay consistent across
  desktop and mobile.

## 1. Engine (`packages/local-engine`)

### New: `listReviewInbox(fs): Promise<NoteListItem[]>`

Returns non-deleted notes with `type === "fleeting"`, sorted by `createdAt`
ascending. Both apps call this, so the rule and the order cannot drift
between them. `NoteListItem` carries no `createdAt`, which is why the sort
lives in the engine and not in each app.

### Reverted: auto-queueing in `createNote`

Earlier on 2026-10-04 `createNote` was changed to set `reviewDue` to today
for fleeting notes, with a `localToday()` helper in `srs.ts`. Both are
removed: under the inbox rule the stamp is redundant, and it would leave
stray schedule data for Flashcards to untangle later. `createNote` goes back
to `reviewDue: null`. The three engine tests added with it are removed.

### Unchanged

`addToReviewQueue`, `removeFromReviewQueue`, `listDueForReview`,
`submitReview`, `srs.ts` and their tests stay, unused by either app.
Type changes go through the existing `updateNote`; deletion through
`deleteNote`.

## 2. Shared copy (`packages/core/src/copy.ts`)

The Review labels both apps show come from one place: the screen title, the
"N of M" counter, Skip, Delete, the delete confirmation, and the caught-up
message. Type button labels come from `NOTE_TYPES` in `packages/themes`, as
every other type picker does.

## 3. The Review screen (both apps)

One note at a time, with a "3 of 12" counter. The list is fetched once when
Review opens; the counter's total does not change during the session.

**The card** shows the zettel id, an editable title and an editable body.

- Desktop: the title is an input and the body is `NoteEditor` in compact
  mode, as on flow cards, so `[[link]]` and `#tag` suggestions work.
- Mobile: the title and body are the same inputs the note screen uses.
- Edits save on a short debounce and are flushed before any action, before
  moving to the next note, and before the screen closes.

**The actions**, under the card:

| Action | Effect |
|---|---|
| Permanent / Literature / Structure | Flush edits, set the type, go to the next note |
| Skip | Flush edits, go to the next note. The note stays fleeting and is back next time |
| Delete | Confirmation dialog. On confirm, delete the note and go to the next one |

`daily` is not offered: a journal entry is tied to a date and is made from
the Today button. `fleeting` is not offered either; that is what Skip means.

**After the last note**, and when there are no fleeting notes at all, the
screen shows the caught-up message and a Close button, as today.

**Closing.** Desktop: the Close button or Escape. Escape first dismisses an
open suggestion list or the delete confirmation, as in the flow view.
Mobile: the back gesture or the Close button.

**Errors.** If setting the type or deleting fails, the screen stays on the
same note and shows the app's usual error message; nothing advances.

## 4. Entry points (both apps)

- **Sidebar / vault tab Review button:** unchanged in place. Its badge now
  shows the number of fleeting notes and updates when a note is created,
  deleted or changes type anywhere in the app.
- **Command palette "Review":** description changes from "Start a
  spaced-repetition review session" to "Sort your fleeting notes".
- **Removed:** the "Add to review queue" / "Remove from review queue" button
  in the note header (desktop) and on the note screen (mobile).

## 5. Desktop (`apps/desktop`)

- `ReviewSession.tsx`: rewritten around the editable card and action row.
  Props change from `onRate` to `onSetType`, `onSkip`, `onDelete` and
  `onSave`, plus note titles and tag names for suggestions.
- `page.tsx`: `openReview` reads `listReviewInbox`; `rateReviewNote` and
  `toggleReviewQueue` go; `refreshDueCount` counts the inbox and is also
  called after a type change. The open note in the main editor is refreshed
  if Review changed or deleted it.
- `vaultClient.ts`, `preload.js`, `main.js`: expose `listReviewInbox`.
- `e2e/bridge.ts`: the stub gains `listReviewInbox` and loses the
  auto-queue line added today.

## 6. Mobile (`apps/mobile`)

- `app/review.tsx`: rewritten to the same behaviour.
- `app/(tabs)/index.tsx`: the badge counts `listReviewInbox`; the command's
  description changes.
- `app/vault/[id].tsx`: the review-queue button and `toggleReviewQueue` go.
- `lib/vault.ts`: exposes `listReviewInbox`.

## 7. Docs

- `docs/features/review.md`: new, describes the triage inbox.
- `docs/features/spaced-repetition.md`: status changed to "parked, hidden
  from the UI, to return as Flashcards"; today's auto-queue note removed.
- `docs/ROADMAP.md`: Flashcards added as a future feature.

## 8. Testing

- **Engine unit tests:** `listReviewInbox` returns only fleeting notes,
  oldest first, and leaves out deleted ones; a note drops out once its type
  changes.
- **Desktop Playwright** (`e2e/review.e2e.ts`, replacing
  `spaced-repetition.e2e.ts`): badge count follows creates, type changes and
  deletes; each type button retypes and advances; Skip leaves the note
  fleeting; Delete asks first; an in-place edit persists; the caught-up
  state; the queue button is gone from the note header.
- **Mobile:** typecheck, then a manual pass on the Pixel_7a emulator through
  the same cases. Mobile has no automated UI tests.

## Out of scope

- Flashcards: any spaced-repetition UI, including bringing the old screen
  back under a new name.
- Remembering that a note was skipped, or hiding skipped notes.
- Bulk actions, tagging shortcuts, or assigning a zettel position in Review.
- Migrating or clearing `reviewDue` data already in vaults.
