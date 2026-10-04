# Flow view on mobile

**Date:** 2026-10-04
**Status:** Approved in conversation (full parity option); built the same day

## Goal

Mobile gets the Flow view desktop has: the vault's notes as cards laid out
top to bottom along their links, with arrows, and usable as a working
surface. Same behaviour as `docs/features/flow-view.md` describes for
desktop, with touch in place of mouse and keyboard.

## Decisions

- **Full parity, not read-only.** Cards are edited, retyped, created,
  deleted and dragged on the phone too.
- **One definition of the layout.** Card size, automatic positions, the
  "step sideways when a slot is taken" rule, arrow routing and rounding,
  the tag filter rule and the tag option list move out of desktop's
  `FlowView.tsx` into `packages/local-engine/src/flow-view.ts`. Both apps
  call them, so a flow looks the same on both.
- **A fourth tab.** Flow sits next to Graph in the tab bar, as the two sit
  next to each other in desktop's sidebar, and is in the command list.

## Touch equivalents

| Desktop | Mobile |
|---|---|
| Drag the background to pan, wheel to zoom | One finger pans, two fingers pinch-zoom |
| Drag a card by its header strip | Same, with a finger |
| Hover a card to colour its arrows | The card last touched colours its arrows |
| Ctrl/Cmd+click a `[[link]]` in a card | A row of link chips under the card's text; tap one |
| Tag search box with suggestions | A scrolling row of tag chips; tap to toggle |
| Type dropdown in the card header | Tap the type label; pick from a sheet |
| "Open in editor" button | Same button; pushes the note screen |
| Escape closes | Not needed: Flow is a tab |

Tapping a link chip opens the note when it exists. When it doesn't, the
note is created on the flow with the card's tags as `#hashtags` (minus the
journal tag) and an arrow from the card, exactly as desktop's Ctrl+click
does.

## Behaviour carried over unchanged

- Cards show the zettel id, type, title and full text; text and title save
  on a 600 ms debounce and are flushed before a type change, before
  opening the note, and when leaving the tab.
- A dragged card stays put; the rest follow the automatic layout.
  **Auto-arrange** clears every dragged position.
- The tag filter shows notes carrying any chosen tag; **Untagged** is
  offered when some notes have no tags. The **Journal** chip hides or shows
  daily notes; choosing the journal tag turns hiding off.
- A card being edited stays visible even if its tags stop matching.
- **New note** adds a fleeting card and puts the cursor in its title.
- Delete asks first.

## Storage

Card positions are view state. Mobile keeps them in the app's own
`settings.json` (next to theme and mode) under `flowPositions`, not in the
vault. They are separate from desktop's, as desktop's are per device too.

## Not in this piece

- `[[` and `#` suggestions while typing inside a card. Mobile's note screen
  has `[[` suggestions only; `#` suggestions are in the small parity batch,
  and both will be added to flow cards with it.
- Sharing card positions between devices.

## Testing

- Engine: unit tests for every function in `flow-view.ts`.
- Desktop: the existing flow e2e specs must still pass after it switches to
  the shared functions.
- Mobile: typecheck, then a pass on the Android emulator covering pan,
  zoom, drag, auto-arrange, tag and journal filters, edit, retype, create,
  delete, open, and both link-chip cases.
