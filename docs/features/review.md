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
`apps/desktop/e2e/review.e2e.ts`. Mobile: typecheck plus a
manual pass on the Android emulator (no automated UI tests there).
