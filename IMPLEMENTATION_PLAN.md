# VaultVista — Implementation Plan

Architecture, per-feature schema, and UI/layout principles for building VaultVista. Companion to `DEVELOPMENT_PLAN.md`.

## 1. Application Architecture

One Express service is the only thing that touches Postgres. Every client — web today, desktop and mobile later — is just a different front door to the same API.

**Monorepo layout:**
```
vaultvista/
├── apps/
│   ├── web/       Next.js, output: 'standalone' — the browser client
│   ├── api/       Express + tRPC — the one backend every client calls
│   └── worker/    Background jobs (BullMQ) — digests, embeddings, review scheduling
├── packages/
│   ├── core/      Zod schemas, tRPC router types, auth/token logic — shared by
│   │              web today, and by Tauri + React Native once they exist
│   ├── db/        Prisma schema, migrations, generated client
│   └── ui/        Shared React components consumed by apps/web
```

**Request flow:** Web / Desktop (Tauri) / Mobile (React Native, later) → HTTPS + JWT → Express API (tRPC + Prisma + JWT auth) → PostgreSQL. The API also enqueues background work onto Redis, processed by a separate Worker process (digests, embeddings, spaced-review scheduling), and calls out to Auth.js, object storage, email, and — later — an AI API. Each of `apps/web` and `apps/api` ships as its own Docker image, deployable independently to Render/Fly.io/Railway/a VPS.

**Creating a note — the actual call path:**
1. Client calls `trpc.note.create.mutate({ kbId, title, content })`
2. Express's JWT middleware verifies the access token and attaches `userId`
3. tRPC's Zod input schema rejects a malformed payload before it reaches any handler
4. The procedure checks the user's `Subscription` row — enough knowledge bases and storage left?
5. Prisma writes the `Note` row; a link parser scans the content for `[[wiki-links]]` and upserts resolved/unresolved `Link` rows
6. The typed `Note` object returns to the client; React Query (which tRPC sits on) updates the UI optimistically

**Multi-client auth:** Login issues a short-lived JWT access token plus a longer-lived refresh token. The web app stores the refresh token in an httpOnly cookie; Tauri and React Native store it in the OS keychain. A `RefreshToken` row per device means Settings can list "MacBook — Tauri," "iPhone — RN app," and let a user revoke one without logging out everywhere.

## 2. Schema per Feature

One addition since the original plan: notes now live inside a `KnowledgeBase`, not directly under a user — that's the entity the "how many vaults can I have" free-vs-paid limit actually gates.

**Identity & billing**
- `User` — id, email, display_name, avatar_url, created_at, updated_at
- `OAuthAccount` — id, user_id (FK), provider, provider_account_id
- `RefreshToken` — id, user_id (FK), token_hash, device_label, expires_at, revoked_at
- `Subscription` — user_id (FK), plan (free/pro/team), max_knowledge_bases, max_storage_bytes, stripe_customer_id, stripe_subscription_id

**Knowledge bases (vaults)**
- `KnowledgeBase` — id, owner_id (FK), name, slug, is_default, created_at, updated_at
- `KnowledgeBaseMember` (later — sharing) — kb_id (FK), user_id (FK), role (owner/editor/viewer), invited_at, accepted_at

**Notes & linking (the core loop)**
- `Note` — id, kb_id (FK), author_id (FK), zettel_id (e.g. `"3a2"`, unique per kb), title, content (markdown), type (fleeting/literature/permanent/structure), search_vector (generated `tsvector` column), created_at, updated_at, deleted_at
- `Link` — id, source_note_id (FK), target_note_id (FK, nullable), target_title (for unresolved links), context, resolved (bool)
- `NoteRevision` (nice-to-have) — note_id (FK), content_snapshot, edited_by, created_at
- `Tag` / `NoteTag` — tags.id, name, kb_id; note_tags.note_id (FK), tag_id (FK)

**Attachments & review**
- `Attachment` — id, kb_id (FK), note_id (FK), url, filename, mime_type, size_bytes
- `ReviewQueue` (nice-to-have) — note_id (FK), next_review_at, interval_days, ease_factor, review_count

**Why unresolved links matter:** a `Link` row can exist before its target note does — writing `[[Atomicity]]` before that note exists is normal Zettelkasten practice. Storing `target_title` and a `resolved` flag lets the backlinks panel show "linked mentions" immediately and flip to a real link the moment the target note is created — the same behavior Obsidian and Roam users already expect.

## 3. UI & Layout

Steve Krug's *Don't Make Me Think* boils down to one test: a user should never have to stop and figure out what something means or does. Applied here, the layout is deliberately unoriginal — it borrows the exact conventions Notion, Obsidian, and Logseq users already carry with them.

**Layout:** a persistent three-pane shell — left sidebar (vault switcher, "+ New note", search, section nav, Maps of Content), center note canvas (title, type badge, zettel ID, tags, markdown body with inline `[[links]]`), right panel (linked mentions, unlinked mentions) — plus a global `⌘K` command palette overlay that reaches any note, tag, or command from anywhere.

**Principles applied, not just quoted:**

| Krug principle | What it means | Applied to VaultVista |
|---|---|---|
| Don't make me think | A control's purpose should be obvious at a glance | Note-type badges use plain words — Fleeting / Literature / Permanent — never an unlabeled icon; "+ New note" always sits in the same spot and says exactly that |
| We scan, we don't read | Users hunt for the next click, not the full sentence | Search results and backlinks lead with a bolded title and highlighted match; the editor body stays plain text with no competing chrome |
| Omit needless words | Let the interface explain itself instead of narrating | No "Welcome! Here's how notes work" splash — a starter vault ships with three real, already-linked notes |
| Follow conventions | Don't invent a pattern where a familiar one already works | Sidebar-left, search-top, backlinks-right, ⌘K palette — the layout Notion/Obsidian/Logseq users already carry over |
| The trunk test | Land on any screen and instantly know: what app, what section, how to search | Sidebar always highlights the active section; KB switcher always names the current vault; note title is always the largest text on screen |
| Make clickable things look clickable | Affordance beats discovery | `[[links]]` render underlined in the accent color inline; graph nodes get a visible hover ring before you click through |
| Satisficing | People take the first reasonable option, not the best one | The quick-switcher ranks by likely match, not alphabetically, so the right note is usually the first result |
| Clear clicks beat fewer clicks | More steps are fine if each one is unambiguous | Turning a fleeting note into a permanent one is "Promote to permanent" then confirm — two obvious actions, not one overloaded menu |

**Checked against market standard:**

| UI element | In VaultVista | Where users already know it from |
|---|---|---|
| Persistent left sidebar + vault switcher | ✓ | Notion, Obsidian, Logseq |
| ⌘K command palette / quick switcher | ✓ | Notion, Obsidian, Roam, Linear |
| Right-hand backlinks panel | ✓ | Obsidian, Roam, Logseq |
| Graph view as a first-class nav item | ✓ | Obsidian, Roam |
| Colored type badge instead of folders | ✓ | Notion property tags, RemNote |
| Bottom tab bar on mobile (later) | ✓ | every native iOS/Android app |
