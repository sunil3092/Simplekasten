# Feature Roadmap — gap analysis vs. the PKM/Zettelkasten market

Researched 2026-09-22 against Obsidian, Logseq, Roam Research, RemNote, Tana,
Heptabase, Reflect, Capacities, Notion, Evernote. Sources at the bottom.

**Purpose of this doc:** persistent, resumable plan. If a session runs out of
budget mid-feature, update the status table below and leave the in-progress
feature's spec doc (`docs/features/<slug>.md`) with a "Where this left off"
note — the next session starts by reading this file.

## What VaultVista already has

Atomic notes with Luhmann-style zettel IDs · bidirectional `[[wiki-links]]` +
backlinks panel · note types (fleeting/literature/permanent/structure) ·
full-text search (Postgres tsvector) + Cmd/Ctrl+K quick switcher · auto-parsed
`#hashtags` + tag filter · graph view (local neighborhood + whole vault) ·
CodeMirror 6 editor with link autocomplete · Maps of Content (structure notes
as index pages) · vault export to markdown · dark mode · multi-vault
switching · JWT auth w/ refresh tokens · mobile app (Expo: auth, notes, tags,
photo attachments, voice notes, speech-to-text dictation) · a redesigned,
modern UI (web).

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
| 11 | **Collaboration / shared vaults** | Roam (real-time), Notion | Low priority for a personal Zettelkasten tool; already deferred in the plan | Very large |
| 12 | **Local-first / offline sync** | Obsidian, Logseq | Low priority right now — would mean rearchitecting storage; current cloud-Postgres model is a deliberate, documented tradeoff | Very large |

## Decision: what to build now

Picking the top of the value/effort curve — features that fit the existing
document-based `Note` model without a rewrite, and that compound with each
other (daily notes want templates; templates want a command palette; a
review queue wants nothing else new):

1. **Daily Notes / Journal** — build first, spec at `docs/features/daily-notes.md`
2. **Note templates** — build second (daily notes become far more useful once they can auto-fill from a template), spec at `docs/features/templates.md`
3. **Spaced repetition / review queue** — build third, spec at `docs/features/spaced-repetition.md`

Canvas, web clipper, PDF import, block transclusion, AI features,
collaboration, and offline sync are documented above as deliberately
deferred — each is a multi-session project in its own right and needs an
explicit go-ahead (an LLM API key for AI features; a decision on browser
extension distribution for the clipper; a data-model decision for block
references) before it's worth speccing in detail.

## Status

| Feature | Spec doc | Schema+API | Web UI | Mobile UI | Tested | Shipped |
|---|---|---|---|---|---|---|
| Daily Notes | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Templates | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Spaced repetition | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

*(Update this table as work lands. This is the single source of truth for "where did we leave off.")*

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
