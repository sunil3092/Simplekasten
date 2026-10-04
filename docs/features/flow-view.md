# Feature: Flow view

**Status:** shipped 2026-10-04 on desktop and mobile.
**Why:** gap analysis item #14. Graph view shows how the whole vault
clusters; Flow view reads the same links as a top-to-bottom diagram, so a
chain of reasoning ("this builds on that, which builds on those") can be
followed in order. It is also a working surface: notes can be written,
linked, retyped, created and deleted without leaving it.

## What it does

- Every note is a card showing its title and full text. A note that links
  to another sits above it, with an arrow pointing down to the target.
- Cards arrange themselves, and can be dragged anywhere by their header
  strip. A dragged card stays where it was put; the rest keep following
  the automatic layout. **Auto-arrange** puts every card back.
- Arrows leave from whichever side of a card faces the target and bend
  around any card in the way, so an arrow never appears to start from a
  card it merely passes.
- Hovering a card colours its own arrows.
- The tag search in the header narrows the flow to notes carrying any of
  the chosen tags. Notes with no tag at all are offered as **Untagged**.
- Journal (daily) notes carry a **Journal** badge. A toggle next to the
  search shows how many there are and hides or shows them in one click.
- Cards are edited in place with the same editor as the main view: `[[`
  suggests note titles and `#` suggests existing tags. Each card's header
  has a type dropdown, an "Open in editor" button and a delete button.
- **New note** adds a card with its title selected.

## Data model

None of its own. The view reads `getGraph()` (the nodes and edges Graph
view already uses) and loads each note's text and tags with
`getNoteById()`. Edits go through `updateNote()`, creation through
`createNote()`, deletion through `deleteNote()`.

Card positions are view state, not vault content. They are kept in the
renderer's `localStorage`, keyed by vault path
(`simplekasten.flow-positions:<path>`), so each vault remembers its own
arrangement on that device and nothing is written into the vault for it.

## `packages/local-engine`

Two pure, I/O-free modules, each with its own unit tests:

- `flow-layout.ts` — `layoutFlow(nodes, edges)` returns a layer and an
  order within the layer for every note, Sugiyama-style: back edges are
  dropped to break cycles, layers come from the longest path, and each
  layer is ordered by the average position of its parents.
- `flow-routing.ts` — `routeFlowEdge(from, to, obstacles)` returns the
  polyline for one arrow. It starts as a straight line between the two
  card centres; while any segment passes through another card (padded by a
  clearance), the nearest corner of that card is inserted as a bend. The
  ends are then clipped to the two cards' borders. A card that overlaps
  either end is ignored rather than routed around.

## Desktop UI (`apps/desktop/src/components/FlowView.tsx`)

- **Layout:** cards are 260×170, in a 340×270 grid, which leaves gaps wide
  enough (80 across, 100 down) for an arrow to pass between two neighbours.
  A card with no saved position that would land on a dragged one steps
  sideways until it is free.
- **Editing:** card text is the main `NoteEditor` in its `compact` mode.
  Saves are debounced per card. After each save the page refreshes the
  note list, the sidebar tags, the flow's own tags and arrows, and the
  main editor if it has that note open.
- **Filtering:** a note is shown when it has any chosen tag. The card being
  typed in stays visible even if its tags stop matching, until focus leaves
  it, so retyping a `#hashtag` can't remove the card mid-edit.
- **Journal toggle:** hides notes of type `daily`. Choosing the journal tag
  in the search turns the toggle back on, so the filter never promises
  journal entries and shows none.
- **Keyboard:** Escape closes whatever is on top first (a suggestion list,
  the delete confirmation, the tag list) and the view itself last.

## Testing

- `packages/local-engine`: `flow-layout.test.ts` (chains, branches,
  diamonds, cycles) and `flow-routing.test.ts` (straight lines, side exits,
  bending around one card and around several, overlapping ends).
- `apps/desktop/e2e/flow.e2e.ts`: dragging and remembered positions,
  Auto-arrange, the tag search including Untagged, the journal badge and
  toggle, editing with link and tag suggestions, create and delete, the type
  dropdown, and the cursor and caret on a card.

## Not done

- No mobile flow view.
- Cards don't push each other apart while one is being dragged.
- Filtering shows only notes that carry a chosen tag; a linked note without
  the tag is hidden even when a visible note points to it.
- Positions don't travel with the vault to another device.

## Mobile

Added 2026-10-04 as a fourth tab (`apps/mobile/src/app/(tabs)/flow.tsx`),
spec at `docs/superpowers/specs/2026-10-04-mobile-flow-view-design.md`.
Same behaviour, with touch in place of mouse and keyboard:

- One finger pans, two fingers pinch-zoom. It opens zoomed out far enough
  to show the whole top row, down to half size.
- A card is dragged by its header strip. The card last touched colours its
  arrows.
- A `[[link]]` inside a text field can't be tapped, so each link in a card
  gets a chip under the text. Tapping it opens the note, or, if there is no
  such note yet, creates it on the flow with the card's tags.
- Tags are a scrolling row of chips; the type is picked from a small sheet.

Layout, card size, arrow routing, the tag filter rule and the tag list are
shared with desktop in `packages/local-engine/src/flow-view.ts`, so a flow
is arranged the same way on both. Card positions are per device: mobile
keeps them in the app's `settings.json`, not in the vault.

Not on mobile yet: `[[` and `#` suggestions while typing in a card.
Verified on the Android emulator except pinch-zoom (the test tooling can
only send one finger) and the Journal chip (the test vault had no journal
entries).
