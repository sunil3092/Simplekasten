# VaultVista — Zettelkasten Memory Management App
### Development Plan

## 1. Project Overview & Goals

**Elevator pitch:** VaultVista is a Zettelkasten-based memory management app that turns scattered notes into a living network of atomic, permanently linked ideas. It combines the discipline of Niklas Luhmann's slip-box — atomic notes, permanent IDs, deliberate links — with modern search and retrieval, so your notes become a network you can think with, not an archive you write into and never revisit.

**Core problem:** Most note apps optimize for *capture*, not *retrieval*. Notes pile up in folders, get tagged once, and are never seen again. The real value of note-taking — the connections between ideas — is left implicit, so insights get written down once and forgotten. People lose knowledge not because they failed to record it, but because they never encounter it again at the moment it matters.

**Target users:**
- Researchers & academics — literature notes across many papers that need to connect into original arguments
- Writers & journalists — long-running idea banks that need to resurface at the right draft
- Lifelong learners — building a personal "second brain" from books, courses, articles
- Knowledge teams (later) — small teams wanting a shared, linked wiki instead of a folder of docs

## 2. Core Features (MVP)

### Must-Have
- Atomic notes with permanent, editable IDs in Luhmann's branching scheme (e.g. `3`, `3a`, `3a1`)
- Bidirectional linking (`[[wiki-links]]`) with an automatic backlinks panel
- Note types: fleeting, literature, permanent
- Full-text + tag/type search with a keyboard quick-switcher
- Graph view of the note network (filterable to a note's local neighborhood)
- Markdown editor with live preview and link autocomplete
- Maps of Content (folder-free organization via index notes)
- Plain-text export of the entire vault — no lock-in

### Nice-to-Have (post-MVP)
- Spaced-review resurfacing of old permanent notes
- AI-assisted link suggestions / auto-tagging (embeddings)
- Web clipper / PDF import for literature notes
- Offline-first desktop app (local markdown as source of truth)
- Shared/collaborative vaults with per-note permissions
- Version history and note diffing
- Voice-to-note capture

## 3. Tech Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | One type system across client, server, and schema catches broken note/link references at compile time. |
| Frontend | Next.js (React) + Tailwind CSS | SSR for fast note pages; file-based routing fits a notes-as-pages app; Tailwind keeps a dense card/graph UI consistent. |
| Editor | CodeMirror 6 | Built for structured-text editors — handles `[[link]]` autocomplete and large documents without jank. |
| Graph view | react-force-graph (WebGL) | Canvas/WebGL rendering stays smooth with thousands of note-nodes where SVG force graphs choke. |
| API layer | tRPC | End-to-end typed calls between editor and backend without hand-written REST contracts. |
| ORM | Prisma | Typed schema migrations for the Notes/Links/Tags relations; schema doubles as documentation. |
| Database | PostgreSQL | Foreign keys enforce link integrity; native full-text search (`tsvector`) and `pgvector` cover MVP search and future AI embeddings in one store. |
| Auth | Auth.js | Drop-in OAuth (Google/GitHub) plus email login without building session management from scratch. |
| File storage | S3-compatible (Supabase Storage) | Attachments and clipped images live outside the database, referenced by URL. |
| Hosting | Vercel + Neon/Supabase | Managed Postgres and zero-ops deploys let a small team ship weekly instead of running servers. |
| Desktop shell (later) | Tauri | Wraps the same web app in a lightweight native shell for local-file, offline-first use once requested. |

## 4. High-Level Architecture

The client never talks to the database directly. Every read/write to a note, link, or tag goes through a typed API layer, which is what keeps the note graph consistent as the vault grows.

```
Client (Next.js/React)  <-- calls / renders -->  API layer (tRPC + Prisma)  <-- writes / query results -->  PostgreSQL
                                                        |
                                +-----------------------+-----------------------+
                                |              |                |               |
                             Auth.js    Object storage        Email        AI API (later)
                          (OAuth/email)  (attachments)      (Resend)   (link suggestions, embeddings)
```

**Third-party services:**
- Auth provider (Google/GitHub via Auth.js)
- Object storage (Supabase Storage / S3) for attachments
- Email service (Resend) for auth and digest emails
- AI API (Anthropic Claude or OpenAI, nice-to-have) for link suggestions and summarization
- Privacy-friendly analytics (Plausible/PostHog)

## 5. Database Schema (Basic)

**Users** — `id` (PK), `email`, `display_name`, `oauth_provider`, `oauth_id`, `created_at`

**Notes** — `id` (PK), `user_id` (FK), `zettel_id` (e.g. `"3a2"`), `title`, `content` (markdown), `type` (fleeting/literature/permanent/structure), `created_at`, `updated_at`

**Links** — `id` (PK), `source_note_id` (FK), `target_note_id` (FK), `context` (short text on why they're linked), `created_at`

**Tags** — `id` (PK), `name`, `user_id`
**NoteTags** (join) — `note_id` (FK), `tag_id` (FK)

**Attachments** — `id` (PK), `note_id` (FK), `url`, `filename`, `mime_type`, `size`

**ReviewQueue** (nice-to-have) — `note_id` (FK), `next_review_at`, `interval`, `ease_factor`

## 6. Step-by-Step Development Roadmap

| Phase | Timeline | Scope | Priority | Difficulty |
|---|---|---|---|---|
| 0 — Setup & planning | Week 1 | Repo, CI/CD, design tokens, Prisma schema draft | High | Low |
| 1 — Core backend & data model | Weeks 2–3 | Auth, CRUD for notes/tags/links, Postgres full-text search | High | Medium |
| 2 — Editor & note-taking UI | Weeks 4–6 | Markdown editor, `[[link]]` autocomplete, live backlinks, tag UI | High | High — editor UX is fiddly |
| 3 — Linking engine & graph view | Weeks 7–8 | Bidirectional link resolution, Maps of Content, WebGL graph | High | High — graph performance |
| 4 — Search & retrieval | Weeks 9–10 | Full-text search, filters, ⌘K quick-switcher | Medium | Medium |
| 5 — Import / export | Week 11 | Markdown vault export, Obsidian-vault import | Medium | Medium — parsing edge cases |
| 6 — Polish, onboarding & beta | Weeks 12–13 | Starter-vault templates, empty states, performance pass, closed beta | High | Medium |
| 7 — AI linking, spaced review, offline (post-MVP) | Ongoing | Embedding-based link suggestions, resurfacing queue, Tauri desktop shell | Low–Medium | High |

Estimated MVP timeline: **10–13 weeks** for a team of one to three developers.

## 7. Potential Roadblocks

**1. Graph rendering degrades as the vault grows.** A force-directed graph of several thousand notes/links will jank in-browser well before a power user's vault gets large.
*Mitigation:* Render only the active note's local neighborhood by default; use a WebGL/canvas renderer (react-force-graph) instead of SVG; lazy-load the full graph on demand.

**2. Broken links and duplicate concepts as the vault scales.** Without folders, users will unknowingly create near-duplicate notes or leave orphaned notes with no incoming links, quietly defeating the method.
*Mitigation:* Store note content as `pgvector` embeddings from day one so a "related notes" and orphan-detection job can run even before the AI-suggestion feature ships; flag orphans in a weekly digest.

**3. Local-first expectations vs. a web-first MVP.** The Zettelkasten audience (ex-Obsidian, ex-Logseq users) strongly expects local markdown files and offline access, which a hosted web app can't promise on day one.
*Mitigation:* Treat raw markdown as the canonical stored format (never a proprietary block format) so a future Tauri desktop mode or file-sync layer needs no data migration; ship one-click full-vault export from week one.

---

**Sources consulted:**
- [Best Zettelkasten Software for 2025 (Full Showdown)](https://mattgiaro.com/best-zettelkasten-software/)
- [Obsidian vs Logseq 2026: Which PKM Tool Wins?](https://softpicker.com/obsidian-vs-logseq/)
- [Top 10 Note-Taking and PKM Apps of 2026](https://guptadeepak.com/tools/top-10-note-taking-pkm-apps-2026/)
- [The Complete Guide to Atomic Note-Taking — Zettelkasten Method](https://zettelkasten.de/atomicity/guide/)
- [The Principle of Atomicity — Zettelkasten Method](https://zettelkasten.de/posts/principle-of-atomicity-difference-between-principle-and-implementation/)
