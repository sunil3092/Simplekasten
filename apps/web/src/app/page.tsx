"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { slugify } from "@vaultvista/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "../components/GraphView";
import { NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher } from "../components/QuickSwitcher";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "../lib/session";
import { downloadVaultExport, FORCE_LOGOUT_EVENT, trpc } from "../lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type NoteDetail = RouterOutputs["note"]["getById"];
type KnowledgeBase = RouterOutputs["knowledgeBase"]["list"][number];
type NoteType = NoteListItem["type"];
type TagItem = RouterOutputs["tag"]["list"][number];

const TYPE_STYLES: Record<NoteType, string> = {
  fleeting: "bg-surface-2 text-ink-muted border-line",
  literature: "bg-accent-2-soft text-accent-2 border-accent-2",
  permanent: "bg-accent-soft text-accent-ink border-accent",
  structure: "bg-surface-2 text-ink-muted border-line border-dashed",
};

export default function Home() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(Boolean(getAccessToken())), []);

  // Fired when a 401 survives a refresh attempt — no access or refresh token
  // is going to work, so the only honest move is back to the login screen.
  useEffect(() => {
    function onForceLogout() {
      setAuthed(false);
    }
    window.addEventListener(FORCE_LOGOUT_EVENT, onForceLogout);
    return () => window.removeEventListener(FORCE_LOGOUT_EVENT, onForceLogout);
  }, []);

  function handleLogout() {
    const refreshToken = getRefreshToken();
    clearTokens();
    setAuthed(false);
    if (refreshToken) trpc.auth.logout.mutate({ refreshToken }).catch(() => {});
  }

  return authed ? <Vault onLogout={handleLogout} /> : <Auth onAuthed={() => setAuthed(true)} />;
}

function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result =
        mode === "login"
          ? await trpc.auth.login.mutate({ email, password })
          : await trpc.auth.register.mutate({ email, password, displayName });
      setTokens(result.accessToken, result.refreshToken);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-ink">VaultVista</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted italic">A slip-box for ideas that link back.</p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-ink"
          >
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-sm text-accent-ink underline underline-offset-2"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}

type SaveStatus = "idle" | "saving" | "saved";
interface PendingSave {
  id: string;
  title: string;
  content: string;
  type: NoteType;
}

function Vault({ onLogout }: { onLogout: () => void }) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [kbMenuOpen, setKbMenuOpen] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [creatingKb, setCreatingKb] = useState(false);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [graphData, setGraphData] = useState<RouterOutputs["note"]["graph"] | null>(null);
  // Structure notes are VaultVista's Maps of Content — a curated table of
  // contents you link into rather than a folder you file things under.
  // Surfacing them as a standing sidebar section is what makes folder-free
  // navigation actually work: without this, an index note is no different
  // from any other note once it scrolls out of the recent-notes list.
  const mapsOfContent = useMemo(() => notes.filter((n) => n.type === "structure"), [notes]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoOpenedRef = useRef(false);
  const justCreatedIdRef = useRef<string | null>(null);
  const kbMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trpc.knowledgeBase.list.query().then((list) => {
      setKbs(list);
      setKb(list[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (!kbMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (kbMenuRef.current && !kbMenuRef.current.contains(e.target as Node)) setKbMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [kbMenuOpen]);

  function switchKb(next: KnowledgeBase) {
    setKbMenuOpen(false);
    if (next.id === kb?.id) return;
    hasAutoOpenedRef.current = false;
    setSelected(null);
    setNotes([]);
    setActiveTag(null);
    setKb(next);
  }

  async function createKbAndSwitch() {
    const name = newKbName.trim();
    if (!name) return;
    setCreatingKb(true);
    try {
      const created = await trpc.knowledgeBase.create.mutate({ name });
      setKbs(await trpc.knowledgeBase.list.query());
      setNewKbName("");
      switchKb(created);
    } finally {
      setCreatingKb(false);
    }
  }

  async function refreshNotes(kbId: string, tag?: string | null) {
    setNotes(await trpc.note.list.query({ kbId, tag: tag ?? undefined }));
  }

  async function refreshTags(kbId: string) {
    setTags(await trpc.tag.list.query({ kbId }));
  }

  useEffect(() => {
    if (kb) {
      refreshNotes(kb.id, activeTag);
      refreshTags(kb.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb]);

  // #hashtags are parsed from note content, so the tag list can change on
  // every save — re-filtering here keeps the sidebar list honest without a
  // full page reload.
  useEffect(() => {
    if (kb) refreshNotes(kb.id, activeTag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag]);

  function toggleTag(name: string) {
    setActiveTag((current) => (current === name ? null : name));
  }

  // Reopen the most recently edited note on load — an empty screen on arrival
  // is the one thing every PKM app avoids.
  useEffect(() => {
    if (!hasAutoOpenedRef.current && notes.length > 0 && !selected) {
      hasAutoOpenedRef.current = true;
      openNote(notes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcherOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function flushPending() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) await save(pending);
  }

  async function save(payload: PendingSave) {
    setSaveStatus("saving");
    await trpc.note.update.mutate(payload);
    setSaveStatus("saved");
    if (kb) {
      refreshNotes(kb.id, activeTag);
      refreshTags(kb.id);
    }
    // Saving can change this note's own resolved backlinks (a title edit can
    // resolve a link another note was waiting on) or its tags (a content
    // edit can add/remove #hashtags) — refresh just those derived fields so
    // the open panels don't go stale until the user navigates away and back.
    const fresh = await trpc.note.getById.query({ id: payload.id });
    setSelected((current) =>
      current && current.id === payload.id
        ? { ...current, backlinks: fresh.backlinks, tagNames: fresh.tagNames, contents: fresh.contents }
        : current,
    );
  }

  function scheduleSave(next: PendingSave) {
    pendingRef.current = next;
    setSaveStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) save(pending);
    }, 600);
  }

  async function openNote(id: string) {
    await flushPending();
    setSelected(await trpc.note.getById.query({ id }));
    setSaveStatus("saved");
  }

  async function openGraph() {
    if (!kb) return;
    setGraphData(await trpc.note.graph.query({ kbId: kb.id }));
  }

  async function exportVault() {
    if (!kb) return;
    await downloadVaultExport(kb.id, `${slugify(kb.name, "vault")}-export.zip`);
  }

  async function createNote(title = "Untitled") {
    if (!kb) return;
    await flushPending();
    const note = await trpc.note.create.mutate({ kbId: kb.id, title, content: "", type: "fleeting" });
    await refreshNotes(kb.id);
    justCreatedIdRef.current = note.id;
    setSelected(await trpc.note.getById.query({ id: note.id }));
    setSaveStatus("saved");
  }

  // Pre-selects the title of a note the user just created, so they can type
  // a real title immediately — but only via a layout effect, which commits
  // synchronously right after the title input mounts. The requestAnimationFrame
  // this replaced fired a frame later, which was late enough that a fast
  // click into the editor (test automation, or just a quick typist) could
  // already have moved focus there, and the rAF's focus() would then steal
  // it back mid-keystroke, scattering the rest of the typed text into the
  // title field instead of the body.
  useLayoutEffect(() => {
    if (!selected || selected.id !== justCreatedIdRef.current) return;
    justCreatedIdRef.current = null;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [selected]);

  async function navigateToTitle(title: string) {
    const found = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (found) await openNote(found.id);
    else await createNote(title);
  }

  function updateTitle(value: string) {
    if (!selected) return;
    const next = { ...selected, title: value };
    setSelected(next);
    scheduleSave({ id: next.id, title: next.title, content: next.content, type: next.type });
  }

  function updateContent(value: string) {
    if (!selected) return;
    const next = { ...selected, content: value };
    setSelected(next);
    scheduleSave({ id: next.id, title: next.title, content: next.content, type: next.type });
  }

  async function updateType(value: NoteType) {
    if (!selected) return;
    const next = { ...selected, type: value };
    setSelected(next);
    await flushPending();
    await save({ id: next.id, title: next.title, content: next.content, type: next.type });
  }

  return (
    <div className="flex h-screen bg-bg">
      <aside className="flex w-64 flex-none flex-col border-r border-line bg-surface px-4 py-5">
        <div ref={kbMenuRef} className="relative mb-1">
          <div className="flex items-baseline justify-between">
            <button
              onClick={() => setKbMenuOpen((o) => !o)}
              className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-muted hover:border-accent"
            >
              {kb?.name ?? "VaultVista"} ▾
            </button>
            <button onClick={onLogout} className="font-mono text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted">
              Log out
            </button>
          </div>

          {kbMenuOpen && (
            <div className="absolute top-full left-0 z-10 mt-1 w-56 rounded-md border border-line bg-surface p-1 shadow-lg">
              {kbs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => switchKb(item)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                    item.id === kb?.id ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {item.name}
                </button>
              ))}
              <div className="mt-1 flex gap-1 border-t border-line-soft pt-1">
                <input
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createKbAndSwitch();
                  }}
                  placeholder="New vault name"
                  className="min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
                />
                <button
                  onClick={createKbAndSwitch}
                  disabled={creatingKb || !newKbName.trim()}
                  className="rounded bg-accent px-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <button
                onClick={exportVault}
                className="mt-1 block w-full rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-2"
              >
                Export vault…
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setSwitcherOpen(true)}
          className="mt-4 flex items-center justify-between rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-faint hover:border-accent"
        >
          Jump to…
          <span className="font-mono text-[10px]">⌘K</span>
        </button>
        <button
          onClick={openGraph}
          className="mt-2 rounded-md border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-faint hover:border-accent"
        >
          Graph view
        </button>
        <button
          onClick={() => createNote()}
          className="mt-2 rounded-md border border-accent px-3 py-1.5 text-left text-sm font-medium text-accent-ink hover:bg-accent-soft"
        >
          + New note
        </button>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.name)}
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                  activeTag === t.name
                    ? "border-accent-2 bg-accent-2-soft text-accent-2"
                    : "border-line text-ink-muted hover:border-accent-2"
                }`}
              >
                #{t.name} <span className="opacity-60">{t.noteCount}</span>
              </button>
            ))}
          </div>
        )}

        {mapsOfContent.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">Maps of content</h3>
            <ul className="flex flex-col gap-1">
              {mapsOfContent.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNote(n.id)}
                    className={`block w-full rounded-md border border-dashed px-2.5 py-1 text-left text-sm ${
                      n.id === selected?.id ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-muted hover:border-accent"
                    }`}
                  >
                    {n.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-wider text-ink-faint uppercase">
            <span>
              {notes.length} note{notes.length === 1 ? "" : "s"}
              {activeTag ? ` · #${activeTag}` : ""}
            </span>
            {activeTag && (
              <button onClick={() => setActiveTag(null)} className="normal-case hover:text-ink-muted">
                clear
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-0.5">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openNote(n.id)}
                  className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                    selected?.id === n.id ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className="font-mono text-[11px] text-ink-faint">{n.zettelId}</span>
                  <span className="truncate">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-10 py-8">
          {selected ? (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-3">
                <select
                  value={selected.type}
                  onChange={(e) => updateType(e.target.value as NoteType)}
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${TYPE_STYLES[selected.type]}`}
                >
                  <option value="fleeting">Fleeting</option>
                  <option value="literature">Literature</option>
                  <option value="permanent">Permanent</option>
                  <option value="structure">Structure</option>
                </select>
                <span className="font-mono text-xs text-ink-faint">{selected.zettelId}</span>
                {selected.tagNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleTag(name)}
                    className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-ink-muted hover:border-accent-2 hover:text-accent-2"
                  >
                    #{name}
                  </button>
                ))}
                <span className="ml-auto font-mono text-[10px] text-ink-faint">
                  {saveStatus === "saving" ? "Saving…" : "Saved"}
                </span>
              </div>

              <input
                ref={titleInputRef}
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="mb-4 w-full border-none bg-transparent font-display text-3xl font-semibold text-ink outline-none"
              />

              <NoteEditor
                key={selected.id}
                initialValue={selected.content}
                onChange={updateContent}
                onNavigateLink={navigateToTitle}
                onTagClick={toggleTag}
                noteTitles={notes.filter((n) => n.id !== selected.id).map((n) => n.title)}
              />
            </div>
          ) : (
            <EmptyState onCreate={() => createNote()} />
          )}
        </div>

        {selected && (
          <aside className="w-72 flex-none overflow-y-auto border-l border-line bg-surface px-5 py-6">
            {selected.type === "structure" && (
              <>
                <h3 className="mb-3 font-mono text-xs tracking-wide text-ink-faint uppercase">
                  Contents ({selected.contents.length})
                </h3>
                <ul className="mb-6 flex flex-col gap-2">
                  {selected.contents.map((item, i) => (
                    <li key={item.noteId ?? `${item.title}-${i}`}>
                      <button
                        onClick={() => navigateToTitle(item.title)}
                        className={`block w-full rounded-md border px-3 py-2 text-left text-sm hover:border-accent ${
                          item.resolved ? "border-line text-ink" : "border-dashed border-line text-ink-faint"
                        }`}
                      >
                        {item.zettelId && <span className="mr-1 font-mono text-[10px] text-ink-faint">{item.zettelId}</span>}
                        {item.title}
                      </button>
                    </li>
                  ))}
                  {selected.contents.length === 0 && (
                    <li className="text-sm text-ink-faint">Link to notes with [[wiki-links]] to build the contents list.</li>
                  )}
                </ul>
              </>
            )}
            <h3 className="mb-3 font-mono text-xs tracking-wide text-ink-faint uppercase">
              Linked mentions ({selected.backlinks.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {selected.backlinks.map((b) => (
                <li key={b.noteId}>
                  <button
                    onClick={() => openNote(b.noteId)}
                    className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:border-accent"
                  >
                    <span className="mr-1 font-mono text-[10px] text-ink-faint">{b.zettelId}</span>
                    {b.title}
                  </button>
                </li>
              ))}
              {selected.backlinks.length === 0 && <li className="text-sm text-ink-faint">Nothing links here yet.</li>}
            </ul>
          </aside>
        )}
      </main>

      {switcherOpen && (
        <QuickSwitcher
          recentNotes={notes}
          onSearch={(query) => (kb ? trpc.note.search.query({ kbId: kb.id, query }) : Promise.resolve([]))}
          onSelect={(id) => {
            setSwitcherOpen(false);
            openNote(id);
          }}
          onCreate={(title) => {
            setSwitcherOpen(false);
            createNote(title);
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {graphData && (
        <GraphView
          nodes={graphData.nodes}
          edges={graphData.edges}
          activeNoteId={selected?.id}
          onSelectNode={(id) => {
            setGraphData(null);
            openNote(id);
          }}
          onClose={() => setGraphData(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="mb-4 text-sm text-ink-muted">Your vault is empty — create the first note to get started.</p>
      <button onClick={onCreate} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink">
        + New note
      </button>
    </div>
  );
}
