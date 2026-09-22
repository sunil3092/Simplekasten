# Feature: Note Templates

**Status:** spec complete, implementation queued after Daily Notes.
**Why:** Roam, Obsidian, and Notion all treat templates as a core primitive —
a reusable starting structure (a literature-note skeleton with Source/
Claims/My-take headings, a daily-note skeleton with a Tasks/Log split, etc.)
inserted with one action. Pairs directly with Daily Notes: an empty journal
page is much less useful than one that opens with your daily structure
already in place.

## Data model

New `Template` model, scoped to a knowledge base (templates are per-vault,
like tags — a research vault and a work vault likely want different ones):

```prisma
model Template {
  id        String   @id @default(cuid())
  kbId      String
  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  name      String
  content   String            // markdown body, may contain placeholder tokens (below)
  isDefaultForDailyNote Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([kbId, name])
  @@map("templates")
}
```

`@@unique([kbId, isDefaultForDailyNote])` is tempting but wrong — Postgres
partial unique indexes aren't expressible directly in Prisma's schema DSL;
enforce "only one default daily template" in the `template.setDefaultForDailyNote`
procedure instead (unset any existing default in the same transaction before
setting the new one), same transactional-invariant style already used
elsewhere in this codebase (e.g. `switchKb` clearing state before setting it).

**Placeholder tokens**, expanded at insertion time (not stored expanded):
- `{{date}}` → today's date, human-formatted
- `{{time}}` → current time
- `{{title}}` → the note's current title (useful in a template applied to an
  existing note, not just new ones)

Kept deliberately small — no scripting/templating language, just the
tokens an actual daily-note/literature-note skeleton needs. Expand the set
later only if a concrete workflow needs it.

## API (`apps/api/src/routers/template.ts`, new)

```ts
list:   protectedProcedure.input({kbId}).query        // all templates in a vault
create: protectedProcedure.input({kbId, name, content}).mutation
update: protectedProcedure.input({id, name?, content?}).mutation
delete: protectedProcedure.input({id}).mutation
setDefaultForDailyNote: protectedProcedure.input({id}).mutation
  // unsets any other default in the same kb, sets this one
```

`note.dailyNote` (from the Daily Notes feature) changes: when creating a new
daily note, look up the kb's default-for-daily-note template (if any) and
use its token-expanded content as the new note's initial `content`, instead
of an empty string.

A generic `note.applyTemplate` mutation (`{noteId, templateId}`) lets a user
insert a template into *any* note, not just a fresh daily note — appends the
expanded content to the end of the note's current body (simplest, safest
default; "replace" would risk destroying existing text).

## Web UI (`apps/web`)

- New Settings-ish surface: simplest fit is a "Templates" item in the vault
  switcher dropdown (next to the existing "Export vault…" entry), opening a
  small modal — list of templates with rename/edit/delete, a "New template"
  form (name + a `NoteEditor` instance reused for the content field, since
  it's already a markdown editor component), and a "Use for daily notes"
  toggle mapped to `setDefaultForDailyNote`.
- Note editor header: a "Insert template" button (next to the type select)
  opening a small dropdown of template names; selecting one calls
  `note.applyTemplate` and refreshes the open note.

## Mobile UI (`apps/mobile`)

- Templates are authored on web/desktop in v1 — mobile is a *consumer* of
  templates, not an editor for them, matching how most PKM apps treat
  template management as a desktop-first task (Obsidian, Notion, Roam all
  put template *editing* behind a settings/desktop surface, while template
  *use* is available everywhere).
- Note detail screen: a "+" icon next to the title (or a small toolbar
  button near the mic icon added earlier) opens an action sheet listing
  template names, calling `note.applyTemplate` on selection.
- Daily notes created from the mobile "Today" button still get the default
  template pre-filled automatically server-side — no mobile-specific work
  needed for that path, since `dailyNote`'s template expansion happens in
  the API regardless of caller.

## Testing plan

- `apps/api`: integration tests for template CRUD, `setDefaultForDailyNote`'s
  single-default invariant, `applyTemplate`'s append behavior and token
  expansion, and that a `dailyNote` call picks up the default template.
- `apps/web`: component/e2e coverage for the templates modal and the
  editor's "Insert template" action.

## Open questions

- **Per-type default templates** (a default for literature notes too, not
  just daily notes) — natural extension once this ships; not in v1 scope,
  the schema's `isDefaultForDailyNote` boolean would need to become a
  `defaultForType: NoteType?` field instead. Flagging now so the v1 schema
  choice is understood as provisional, not because v1 needs to solve it.
