# Feature Roadmap — gap analysis vs. the PKM/Zettelkasten market

Researched 2026-09-22 against Obsidian, Logseq, Roam Research, RemNote, Tana,
Heptabase, Reflect, Capacities, Notion, Evernote. Sources at the bottom.

**2026-09-22 architecture note:** while this doc's research was underway, a
parallel effort (`docs/superpowers/specs/2026-09-17-shared-vault-library-design.md`
and its follow-ons) moved the app from "every client talks to an Express +
tRPC API backed by Postgres" to **local-first**: Desktop (now an Electron
app, `apps/web` merged into it) and Mobile each read/write a vault of plain
markdown files (YAML frontmatter + body, one file per note) on the device's
own filesystem through `packages/local-engine`, no server or login required.
`apps/api` + `packages/db` (Postgres/JWT auth) stay in the repo dormant, as
the future home of an *opt-in* cross-device sync feature — not deleted, not
live. The app was also renamed **Simplekasten**. This resolves gap #12
below (it's done, not deferred) and adds a shipped feature this doc's
original pass missed: **installable themes** (`packages/themes` — parse,
resolve, and hot-swap community theme files; ships with Classic and
Memphis). The gap table below is corrected accordingly; feature specs below
it now target the local-engine architecture.

**Purpose of this doc:** persistent, resumable plan. If a session runs out of
budget mid-feature, update the status table below and leave the in-progress
feature's spec doc (`docs/features/<slug>.md`) with a "Where this left off"
note — the next session starts by reading this file.

## What Simplekasten already has

Local-first vault of plain markdown files (YAML frontmatter + body, no
server/login required) shared by Desktop (Electron) and Mobile (Expo)
through `packages/local-engine` · atomic notes with zettel IDs ·
bidirectional `[[wiki-links]]` + backlinks panel · note types
(fleeting/literature/permanent/structure) with shared badge/graph colours
(`packages/themes`) · substring search + create-from-search on both
platforms · auto-parsed `#hashtags` + tag filter · graph view (local
neighborhood + whole vault, pan/pinch-zoom on mobile) · CodeMirror 6 editor
(desktop) / native `[[` suggestions (mobile) · Maps of Content (structure
notes as index pages) · installable/hot-swappable themes (Classic, Memphis,
plus user-supplied theme files) · photo + voice-note attachments on both
platforms (desktop: file picker; mobile: camera/library/recording) · delete
note with confirmation, both platforms · dark mode · a shared UI/copy/icon
layer (`packages/core`) keeping desktop and mobile in visual and
behavioural parity.

## Gap analysis

| # | Feature | Who has it | Value for a Zettelkasten tool | Effort |
|---|---|---|---|---|
| 1 | **Daily Notes / Journal** | Roam, Logseq, Obsidian, Tana — the primary capture surface in nearly every modern PKM app | Very high — fleeting-note capture currently has no "just open the app and write" entry point | Small |
| 2 | **Note templates** | Roam, Obsidian, Notion, RemNote | High — daily notes and literature notes benefit enormously from a starting structure | Small–Medium |
| 3 | **Spaced repetition / review queue** | Obsidian (most-installed plugin category), RemNote (native), Anki-adjacent | High — already called out as a nice-to-have in `DEVELOPMENT_PLAN.md`; is the actual point of a slip-box (resurfacing permanent notes) | Medium |
| 4 | **Visual canvas / whiteboard** | Heptabase (signature feature), Obsidian Canvas, Tana | Medium-high — spatial arrangement complements but doesn't replace graph view | Large |
| 5 | **Web clipper** | Evernote, Notion, Obsidian (via plugin) | Medium — big value for literature notes, but needs a browser extension, a new surface this monorepo doesn't have | Large |
| 6 | **PDF import + annotation** | Obsidian, Notion, Evernote | Medium — literature-note workflow staple | Large |
| 7 | **Block-level references/transclusion** | Roam (best-in-class), Logseq, Tana | Medium — powerful but a fundamental data-model change (block-based vs. document-based notes); high risk to bolt onto the current whole-document `Note` model | Very large |
| 8 | **Version history / diffing** | Notion, Obsidian Sync, Roam | Medium — already a nice-to-have in the plan | Medium |
| 9 | **AI features** (related-notes suggestions, auto-tag, chat-over-vault) | Reflect, Tana, Notion AI, Capacities | Medium — real differentiator now, but needs an LLM API budget/key decision from the user first | Medium (once an API key exists) |
| 10 | **Command palette** (beyond note search — run actions: new daily note, toggle theme, export, etc.) | Obsidian, Notion, Linear | Medium — cheap, compounds nicely once daily notes/templates exist | Small |
| 11 | **Cross-device sync** (opt-in, on top of the now-local vault) | Obsidian Sync, iCloud/Dropbox-synced vaults | Medium — the dormant `apps/api`/`packages/db` are explicitly reserved for this; real product decision (which sync transport?) needed before speccing | Large |
| 12 | ~~Local-first / offline sync~~ | Obsidian, Logseq | **Done** — see architecture note above | — |
| 13 | **Real-time collaboration** (multiple people, one vault) | Roam, Notion | Low priority for a personal Zettelkasten tool | Very large |

## Decision: what to build now

Picking the top of the value/effort curve — features that fit the local
file-based vault model (`packages/local-engine`) without a rewrite, and
that compound with each other (daily notes want templates; templates want a
command palette; a review queue wants nothing else new):

1. **Daily Notes / Journal** — ✅ shipped 2026-09-22, spec at `docs/features/daily-notes.md`
2. **Note templates** — ✅ shipped 2026-09-23, spec at `docs/features/templates.md`
3. **Spaced repetition / review queue** — ✅ shipped 2026-09-23, spec at `docs/features/spaced-repetition.md`

All three are done. Next in line, per the gap analysis below: **#10
Command palette** — cheap (Small effort) and compounds with everything
just built (surfacing "new daily note," "insert template," "start review
session" as palette actions, not just note search).

Canvas, web clipper, PDF import, block transclusion, AI features, sync, and
real-time collaboration are documented above as deliberately deferred —
each is a multi-session project in its own right and needs an explicit
go-ahead (an LLM API key for AI features; a decision on browser extension
distribution for the clipper; a data-model decision for block references; a
sync-transport decision for cross-device sync) before it's worth speccing
in detail.

## Status

| Feature | Spec doc | local-engine | Desktop UI | Mobile UI | Tested | Shipped |
|---|---|---|---|---|---|---|
| Daily Notes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 2026-09-22 |
| Templates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 2026-09-23 |
| Spaced repetition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 2026-09-23 |

*(Update this table as work lands. This is the single source of truth for "where did we leave off." If a session ends mid-feature, leave a "Where this left off" note in that feature's spec doc with the exact next file/function to touch.)*

### Spaced Repetition — shipped 2026-09-23

A simplified SM-2 algorithm (`packages/local-engine/src/srs.ts`, four
ratings: again/hard/good/easy instead of SM-2's 0-5 score) drives a review
queue stored as four flat frontmatter fields on any note (`reviewDue`,
`reviewEase`, `reviewInterval`, `reviewReps`), omitted as a group when a
note isn't queued — same "omit when not applicable" convention `noteDate`
and `attachmentIds` already follow. Any note can join the queue, not just
`permanent` notes — restricting by type would be arbitrary since the queue
is opt-in per note either way.

Both apps get: a "Review" entry point with a due-count badge next to
"Today", a full-screen (desktop) or pushed (mobile) review session
presenting one due note at a time read-only with the four rating buttons
and an "all caught up" end state, and a per-note header toggle to
add/remove it from the queue.

One deviation from the spec's original function signatures:
`addToReviewQueue(fs, noteId, today)` takes `today` as a parameter rather
than computing it — consistent with the client-local-date convention Daily
Notes established (the engine has no timezone concept).

146 unit tests total (67 in local-engine, up from 47) + 20 desktop e2e
tests, all green; mobile confirmed via typecheck and the same visual-smoke
process as Daily Notes and Templates (Expo's web target can't exercise
real vault writes). See `docs/features/spaced-repetition.md` for the full
spec and shipped-state notes.

**All three planned features (Daily Notes, Templates, Spaced Repetition)
are now shipped.** Next up per the gap analysis: **Command palette** (#10)
is the cheapest remaining win and compounds with what's already
built — a `Cmd/Ctrl+K`-adjacent action list (new daily note, toggle theme,
open templates, jump into a review session, export) rather than only note
search. No spec doc exists yet; write one against both apps' existing
QuickSwitcher-equivalents before implementing.

### Templates — shipped 2026-09-23

Templates are files (`templates/<id>.md`, frontmatter + body) with
`{{date}}`/`{{time}}`/`{{title}}` tokens expanded on use. Six new
local-engine functions; a desktop-only authoring surface (a Templates
modal off the sidebar, an "Insert template" dropdown in the note header);
mobile applies templates via an action sheet but doesn't author them,
matching how Obsidian/Notion/Roam treat template editing as desktop-first.
`getOrCreateDailyNote` now pre-fills new daily notes from the
default-for-daily-note template, if one is set.

Caught a real pre-existing-pattern bug while wiring this up: desktop's
`NoteEditor` is uncontrolled by design (mounts once, ignores prop changes
after that) — applying a template updated React state but the CodeMirror
view never reflected it. Fixed by keying the editor on
`${selected.id}:${editorNonce}` and bumping `editorNonce` only when a
template is applied, so ordinary typing still doesn't fight the editor for
cursor position.

126 unit tests total (47 in local-engine) + 18 desktop e2e tests, all
green; mobile confirmed via typecheck and a visual smoke test (same
platform limits as Daily Notes — Expo's web target can't exercise real
vault writes, so full interaction needs a real emulator, none available
in this sandbox). See `docs/features/templates.md` for the full spec.

**Next up (as of this writing): Spaced Repetition** — since shipped
2026-09-23; see that section above for what it turned into.

### Daily Notes — shipped 2026-09-22

`getOrCreateDailyNote`/`listDailyNotes` in `packages/local-engine/src/vault.ts`,
a `daily` note type (`packages/core`, `packages/themes`), a "Today" entry
point plus prev/next-day navigation on both Desktop (with a sidebar
"Journal" section) and Mobile, and a `Cmd/Ctrl+J` shortcut on desktop.
115 unit tests + 15 desktop e2e tests green; mobile confirmed via typecheck
and a visual smoke test (full on-device verification needs a real
Android/iOS emulator, per this project's established testing convention —
none available in this sandbox). See `docs/features/daily-notes.md` for the
full spec this was built from.

**Next up: Templates.** Its spec doc needs the same local-engine rewrite
daily-notes.md got before implementation starts — follow that doc's
"Where this left off" note.

## Sources

- [Best Obsidian Alternatives for Note-Taking (2026)](https://www.taskade.com/blog/obsidian-alternatives)
- [Top 10 Note-Taking and PKM Apps of 2026](https://guptadeepak.com/tools/top-10-note-taking-pkm-apps-2026/)
- [Best Zettelkasten Software for 2025 (Full Showdown)](https://mattgiaro.com/best-zettelkasten-software/)
- [Best PKM App (2026): 12 Tools Compared and Ranked](https://ainotely.com/blog/pkm-app/)
- [Obsidian vs Logseq 2026](https://thesoftwarescout.com/obsidian-vs-logseq-2026-which-note-taking-app-wins/)
- [Heptabase vs. Tana: Which is the Best Note-Taking and PKM App of 2025](https://paperlessmovement.com/videos/heptabase-vs-tana-which-is-the-best-note-taking-and-pkm-app-of-2025/)
- [Best Tana Features For Building A Tana PKM System](https://otio.ai/blog/tana-pkm)
- [16 Best Second Brain Apps in 2026](https://buildin.ai/blog/best-second-brain-apps-2026)
- [Spaced Repetition – Obsidian Plugin](https://www.obsidianstats.com/plugins/obsidian-spaced-repetition)
- [Best Plugins for Spaced Repetition and Active Recall in Obsidian](https://www.obsidianstats.com/posts/2025-05-01-spaced-repetition-plugins)
- [Obsidian plugins with #canvas](https://www.obsidianstats.com/tags/canvas)
- [Logseq vs Roam Research: which should you choose in 2026?](https://fabric.so/comparison/logseq-vs-roam-research)
- [Using Templates in Roam Research](https://padminipyapali.medium.com/using-templates-in-roam-research-ee6bd480f3e0)
- [Evernote Web Clipper](https://evernote.com/features/webclipper)
