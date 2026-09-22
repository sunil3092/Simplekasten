# Feature: Daily Notes / Journal

**Status:** spec complete, implementation next.
**Why:** every modern PKM app (Roam, Logseq, Obsidian, Tana) opens to a
"today" page by default — it's the low-friction capture surface for fleeting
thoughts before they're refiled into permanent notes. VaultVista currently
has no such entry point; creating a note always means typing a title first.
This is the single highest-value gap found in the competitive research
(`docs/ROADMAP.md`).

## Data model

Reuse the existing `Note` table rather than a parallel model — a daily note
*is* a note, just one the system creates automatically and indexes by
calendar date. Two additions:

```prisma
enum NoteType {
  fleeting
  literature
  permanent
  structure
  daily        // new
}

model Note {
  // ...existing fields unchanged...
  noteDate DateTime? @db.Date   // new — set only when type == daily; the
                                 // calendar day (UTC midnight) this note
                                 // represents. NULL for every other note.

  @@unique([kbId, noteDate])     // new — Postgres treats each NULL as
                                 // distinct, so this only prevents two
                                 // daily notes landing on the same date
                                 // within one vault; ordinary notes
                                 // (noteDate = NULL) are unaffected.
}
```

Migration must be hand-written (per this repo's established pattern — see
`packages/db/prisma/migrations/20260908160345_add_search_vector/`) because
the `searchVector` generated column means `prisma migrate dev`'s diff engine
can't be trusted to auto-generate a clean migration; write it, then apply
with `prisma migrate deploy`.

`zettelId` is still assigned via the normal `nextZettelId(kbId)` sequence —
daily notes are full participants in the Zettelkasten numbering, not a
separate namespace. `title` defaults to a human date string ("September 22,
2026"); `content` starts empty (templates, once built, will pre-fill it —
see `docs/features/templates.md`).

## API (`apps/api/src/routers/note.ts`)

Two new procedures:

```ts
// Get-or-create semantics in one round trip — the client always calls this
// rather than checking existence first, so opening "today" is a single
// request on both web and mobile.
dailyNote: protectedProcedure
  .input(z.object({ kbId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .mutation(...)

// Recent daily notes for a "Journal" sidebar section (mirrors how
// mapsOfContent is already derived client-side from note.list — but this
// needs its own query since regular note.list excludes type-based sections
// by design and a journal wants date-descending order specifically).
listDaily: protectedProcedure
  .input(z.object({ kbId: z.string(), limit: z.number().min(1).max(100).default(30) }))
  .query(...)
```

`date` is passed by the client (today's date in the *client's* local
timezone, formatted `YYYY-MM-DD`) rather than computed server-side — the
server has no reliable notion of the user's timezone, and "today" is
inherently a client-local concept. Both web and mobile compute it the same
way: `new Date().toLocaleDateString("en-CA")` (gives `YYYY-MM-DD` in local
time; `en-CA` is a locale-format trick, not a hardcoded region).

`packages/core/src/schemas.ts`'s `noteTypeSchema` gains `"daily"`.

## Web UI (`apps/web`)

- Sidebar: a "Today" button (calendar icon) above "+ New note", using the
  same `Button`/icon primitives from the recent redesign
  (`components/ui.tsx`, `components/icons.tsx` — add a `CalendarIcon`).
  Calls `dailyNote.mutate({kbId, date: todayLocal()})` and opens the result
  exactly like `openNote` does.
- New "Journal" section in the sidebar (below Maps of Content, above the
  regular notes list), populated from `listDaily`, showing each entry's date
  label; clicking opens that day's note. Mirrors the existing
  `mapsOfContent` section's markup/pattern in `page.tsx`.
- Note editor header: daily notes get a distinct badge like the existing
  `structure` dashed-border treatment, plus Prev/Next-day arrow buttons
  (navigate by calling `dailyNote.mutate` with `date ± 1 day`, creating that
  day's note on demand if it doesn't exist yet — matching Roam/Logseq's
  "scroll to any day" behavior).
- Keyboard shortcut: reuse the `Cmd/Ctrl+K` pattern's key-handling
  `useEffect` to also bind a dedicated "today" shortcut (e.g. `Cmd/Ctrl+J`,
  unclaimed in the current app).

## Mobile UI (`apps/mobile`)

- Vault list screen (`src/app/vault/index.tsx`): a "Today" pill button in
  the header row, next to the existing "+ New note" affordance — same
  get-or-create call, then `router.push`'s to the note detail screen like
  creating any other note does today.
- Note detail screen (`src/app/vault/[id].tsx`): when `note.type ===
  "daily"`, show Prev/Next-day chevron buttons in the header row (mirrors
  web); tapping calls the same `dailyNote` mutation with an adjusted date.
- No separate "Journal" list screen for v1 — mobile's screen real estate
  favors keeping this to the single Today entry point plus prev/next
  navigation from within a daily note; a full journal browser can follow
  once the pattern proves useful (same reasoning Roam/Logseq mobile clients
  apply — the journal list is a desktop-sidebar affordance).

## Testing plan

- `packages/core`: unit test the updated `noteTypeSchema` accepts `"daily"`.
- `apps/api`: integration test `dailyNote` — first call creates, second call
  with the same date returns the same note (no duplicate), a different date
  creates a second note, cross-user access is rejected (matches the existing
  integration-test conventions in `note.integration.test.ts`).
- `apps/web`: one new Playwright e2e spec (`daily-notes.spec.ts`) — clicking
  "Today" opens a note dated today; clicking it again doesn't create a
  duplicate; Next-day navigation creates tomorrow's note.
- Manual: visually verify web sidebar Journal section and mobile Today
  button via the dev-server + Playwright screenshot pattern already
  established in this project.

## Open questions (resolved defaults, revisit if wrong)

- **Timezone**: client-local, per above — no per-user timezone setting
  exists yet, so "today" always means the device's local calendar day.
- **Template pre-fill**: deferred to the templates feature; daily notes
  start empty until that lands.
