# Feature: Note Templates

**Status:** rewritten 2026-09-23 for the local-engine architecture. Ready to implement.
**Why:** Roam, Obsidian, and Notion all treat templates as a core primitive —
a reusable starting structure (a literature-note skeleton with Source/
Claims/My-take headings, a daily-note skeleton with a Tasks/Log split, etc.)
inserted with one action. Pairs directly with Daily Notes (shipped — see
`docs/features/daily-notes.md`): an empty journal page is much less useful
than one that opens with your daily structure already in place.

## Data model (`packages/local-engine`)

Templates are files, the same storage shape as notes and attachments: a new
`templates/` directory alongside `notes/` and `attachments/`, one file per
template, frontmatter + body:

```
templates/<id>.md
---
id: abc123
name: Daily Log
isDefaultForDailyNote: true
createdAt: 2026-09-23T00:00:00.000Z
updatedAt: 2026-09-23T00:00:00.000Z
---
## Tasks

## Log

Written on {{date}} at {{time}}.
```

`packages/local-engine/src/types.ts` gains:
```ts
export interface Template {
  id: string;
  name: string;
  content: string; // may contain {{date}}, {{time}}, {{title}} tokens, expanded at apply time
  isDefaultForDailyNote: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`packages/local-engine/src/template-file.ts` (new, mirrors `note-file.ts`
exactly — same frontmatter regex, same js-yaml round-trip):
```ts
export function parseTemplateFile(raw: string, id: string): Template
export function serializeTemplateFile(template: Template): string
```

**Placeholder tokens**, expanded when a template is applied (never stored
expanded, so editing a template later affects only future uses):
- `{{date}}` → today's date, human-formatted (reuses `formatHumanDate` from
  `vault.ts`, already built for Daily Notes)
- `{{time}}` → current time, locale-formatted
- `{{title}}` → the target note's current title (useful applying a template
  to an existing note, not just a fresh one)

Kept deliberately small — no scripting/templating language, just the tokens
an actual daily-note/literature-note skeleton needs.

**Single-default invariant**: at most one template has
`isDefaultForDailyNote: true`. Enforced in `setDefaultForDailyNote` itself
(unset any other template carrying the flag, in the same call, before
setting the new one) — there's no transaction to reach for in a
file-per-record store, so "read all, write the ones that changed" is the
whole mechanism, same spirit as `deleteAttachment` rewriting the note that
referenced it.

## `packages/local-engine/src/vault.ts` — new functions

```ts
export async function listTemplates(fs: FileSystemAdapter): Promise<Template[]>
export async function createTemplate(fs: FileSystemAdapter, input: { name: string; content: string }): Promise<Template>
export async function updateTemplate(fs: FileSystemAdapter, input: { id: string; name?: string; content?: string }): Promise<Template>
export async function deleteTemplate(fs: FileSystemAdapter, id: string): Promise<void>
export async function setDefaultForDailyNote(fs: FileSystemAdapter, id: string): Promise<Template>

// Expands {{date}}/{{time}}/{{title}} and appends to the target note's
// current content — append, not replace, so applying a template never
// destroys existing text. Returns the updated note via getNoteById so
// callers can refresh in one round trip.
export async function applyTemplate(fs: FileSystemAdapter, input: { noteId: string; templateId: string }): Promise<NoteDetail>
```

`getOrCreateDailyNote` (shipped in Daily Notes) changes by one line: instead
of always creating with `content: ""`, look up
`listTemplates(fs).find(t => t.isDefaultForDailyNote)` and use its
expanded content when present.

## Desktop UI (`apps/desktop`)

- IPC (`main.js`/`preload.js`/`vaultClient.ts`) gains the five calls above,
  same pass-through pattern as every other vault operation.
- Vault switcher area: a "Templates…" entry (next to "Choose vault folder…")
  opening a modal — list of templates with rename/delete, a "New template"
  form (name input + a `NoteEditor` instance reused for the content field,
  since it's already the markdown editor component this app uses), and a
  "Use for daily notes" toggle per template mapped to
  `setDefaultForDailyNote`. Follows the same modal pattern `SettingsModal`
  already establishes in this codebase.
- Note header: an "Insert template" `IconButton` (next to the attach-file
  button) opens a small dropdown of template names; selecting one calls
  `applyTemplate` then refreshes the open note the same way
  `refreshAttachments` does after an attachment change.

## Mobile UI (`apps/mobile`)

- Templates are authored on desktop in v1 — mobile is a *consumer*, not an
  editor, matching how Obsidian/Notion/Roam all put template *editing*
  behind a desktop-first surface while template *use* is available
  everywhere.
- Note screen: an icon button in the header (next to delete) opens an
  action sheet (`Alert.alert`-style options, matching how `confirmDelete`
  already presents a native choice) listing template names; picking one
  calls `vault.applyTemplate` and refreshes the note.
- Daily notes created from the mobile "Today" button automatically pick up
  the default template — no mobile-specific work needed, since
  `getOrCreateDailyNote`'s template lookup happens inside the shared engine
  regardless of which platform's adapter calls it.

## Testing plan

- `packages/local-engine`: unit tests for template CRUD, the single-default
  invariant (setting a second default unsets the first), `applyTemplate`'s
  token expansion and append-not-replace behavior, and that
  `getOrCreateDailyNote` picks up a default template when one exists and
  falls back to empty content when none does — same style as
  `vault.test.ts`'s existing daily-notes describe block.
- `apps/desktop`: extend `e2e/bridge.ts`'s stub with the five calls; add a
  spec covering create/rename/delete a template, set-and-unset default, and
  applying a template to a note.
- `apps/mobile`: `tsc` typecheck, then a visual smoke test through Expo's
  web target for the UI layer (full behavior verification goes through the
  shared engine's own test suite, same reasoning as Daily Notes' mobile
  verification).

## Status: shipped 2026-09-23

Implemented as specced above, with `applyTemplate` ending up in `vault.ts`
as a sixth function (not five — the spec's own function list already named
it, this just corrects the earlier count in this note). See
`docs/ROADMAP.md`'s status table for verification details (126 unit tests,
18 desktop e2e tests, mobile typecheck + visual smoke test), and its
Templates entry for the one real bug this surfaced (desktop's `NoteEditor`
needing a remount key bump to reflect an externally-applied template).

## Open questions (resolved defaults, revisit if wrong)

- **Per-type default templates** (a default for literature notes too, not
  just daily notes) — natural extension once this ships; not in v1 scope.
  `isDefaultForDailyNote: boolean` would become `defaultForType: NoteType |
  null` if this is wanted later. Flagging now so the v1 field choice is
  understood as provisional.
