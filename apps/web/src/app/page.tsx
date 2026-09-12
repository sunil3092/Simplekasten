"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { slugify } from "@vaultvista/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "../components/GraphView";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  HashIcon,
  LayersIcon,
  LinkIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "../components/icons";
import { NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher } from "../components/QuickSwitcher";
import { Button, Chip, Kbd, SaveStatusIndicator } from "../components/ui";
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
  literature: "bg-accent-2-soft text-accent-2 border-accent-2/40",
  permanent: "bg-accent-soft text-accent-ink border-accent/40",
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
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await trpc.auth.login.mutate({ email, password })
          : await trpc.auth.register.mutate({ email, password, displayName });
      setTokens(result.accessToken, result.refreshToken);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-display text-lg font-bold text-white shadow-sm">
            V
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">VaultVista</h1>
          <p className="mt-1 text-sm text-ink-muted">A slip-box for ideas that link back.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm">
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            {mode === "register" && (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                  <UserIcon />
                </span>
                <input
                  className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/50"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                <MailIcon />
              </span>
              <input
                className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/50"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                <LockIcon />
              </span>
              <input
                className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/50"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error && (
              <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                <span className="mt-0.5 flex-none">
                  <AlertCircleIcon />
                </span>
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={submitting} className="mt-1 w-full">
              {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="mt-5 w-full text-center text-sm text-accent-ink transition-colors hover:text-accent"
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
          </button>
        </div>
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
      <aside className="flex w-64 flex-none flex-col border-r border-line bg-surface px-3.5 py-4">
        <div ref={kbMenuRef} className="relative mb-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setKbMenuOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              <span className="truncate">{kb?.name ?? "VaultVista"}</span>
              <ChevronDownIcon className="flex-none text-ink-faint" />
            </button>
            <button
              onClick={onLogout}
              className="flex flex-none items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <LogOutIcon />
              Log out
            </button>
          </div>

          {kbMenuOpen && (
            <div className="animate-fade-scale-in absolute top-full left-0 z-10 mt-1.5 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
              {kbs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => switchKb(item)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                    item.id === kb?.id ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  {item.id === kb?.id && <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />}
                </button>
              ))}
              <div className="mt-1.5 flex gap-1 border-t border-line-soft pt-1.5">
                <input
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createKbAndSwitch();
                  }}
                  placeholder="New vault name"
                  className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                />
                <button
                  onClick={createKbAndSwitch}
                  disabled={creatingKb || !newKbName.trim()}
                  className="flex-none rounded-md bg-accent px-2 text-xs font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <button
                onClick={exportVault}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2"
              >
                <DownloadIcon />
                Export vault…
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-faint transition-colors hover:border-accent/50 hover:text-ink-muted"
          >
            <span className="flex items-center gap-2">
              <SearchIcon />
              Jump to…
            </span>
            <Kbd>⌘K</Kbd>
          </button>
          <button
            onClick={openGraph}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-faint transition-colors hover:border-accent/50 hover:text-ink-muted"
          >
            <NetworkIcon />
            Graph view
          </button>
          <button
            onClick={() => createNote()}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-left text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-ink"
          >
            <PlusIcon />
            <span>+ New note</span>
          </button>
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t.id} active={activeTag === t.name} onClick={() => toggleTag(t.name)}>
                #{t.name} <span className="opacity-60">{t.noteCount}</span>
              </Chip>
            ))}
          </div>
        )}

        {mapsOfContent.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-wider text-ink-faint uppercase">
              <LayersIcon />
              Maps of content
            </h3>
            <ul className="flex flex-col gap-1">
              {mapsOfContent.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNote(n.id)}
                    className={`block w-full rounded-lg border border-dashed px-2.5 py-1.5 text-left text-sm transition-colors ${
                      n.id === selected?.id ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-muted hover:border-accent/50"
                    }`}
                  >
                    {n.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-1.5 flex items-center justify-between px-2 font-mono text-[10px] font-medium tracking-wider text-ink-faint uppercase">
            <span>
              {notes.length} note{notes.length === 1 ? "" : "s"}
              {activeTag ? ` · #${activeTag}` : ""}
            </span>
            {activeTag && (
              <button onClick={() => setActiveTag(null)} className="normal-case transition-colors hover:text-ink-muted">
                clear
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-0.5">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openNote(n.id)}
                  className={`flex w-full items-baseline gap-2 rounded-lg border-l-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
                    selected?.id === n.id
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-transparent text-ink hover:bg-surface-2"
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
            <div className="mx-auto max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="relative">
                  <select
                    value={selected.type}
                    onChange={(e) => updateType(e.target.value as NoteType)}
                    className={`appearance-none rounded-md border py-1 pr-6 pl-2.5 font-mono text-[10px] font-medium tracking-wide uppercase transition-colors focus:outline-none ${TYPE_STYLES[selected.type]}`}
                  >
                    <option value="fleeting">Fleeting</option>
                    <option value="literature">Literature</option>
                    <option value="permanent">Permanent</option>
                    <option value="structure">Structure</option>
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 opacity-60" />
                </div>
                <span className="font-mono text-xs text-ink-faint">{selected.zettelId}</span>
                <div className="flex flex-wrap items-center gap-1">
                  {selected.tagNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => toggleTag(name)}
                      className="inline-flex items-center gap-0.5 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent-2 hover:text-accent-2"
                    >
                      <HashIcon />
                      {name}
                    </button>
                  ))}
                </div>
                <span className="ml-auto">
                  <SaveStatusIndicator status={saveStatus} />
                </span>
              </div>

              <input
                ref={titleInputRef}
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="font-display mb-5 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-faint"
                placeholder="Untitled"
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
                <h3 className="mb-3 flex items-center gap-1.5 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">
                  <LayersIcon />
                  Contents ({selected.contents.length})
                </h3>
                <ul className="mb-6 flex flex-col gap-2">
                  {selected.contents.map((item, i) => (
                    <li key={item.noteId ?? `${item.title}-${i}`}>
                      <button
                        onClick={() => navigateToTitle(item.title)}
                        className={`flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-accent/60 hover:shadow-sm ${
                          item.resolved ? "border-line text-ink" : "border-dashed border-line text-ink-faint"
                        }`}
                      >
                        {item.zettelId && <span className="font-mono text-[10px] text-ink-faint">{item.zettelId}</span>}
                        <span className="truncate">{item.title}</span>
                      </button>
                    </li>
                  ))}
                  {selected.contents.length === 0 && (
                    <li className="text-sm text-ink-faint">Link to notes with [[wiki-links]] to build the contents list.</li>
                  )}
                </ul>
              </>
            )}
            <h3 className="mb-3 flex items-center gap-1.5 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">
              <LinkIcon />
              Linked mentions ({selected.backlinks.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {selected.backlinks.map((b) => (
                <li key={b.noteId}>
                  <button
                    onClick={() => openNote(b.noteId)}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink transition-colors hover:border-accent/60 hover:shadow-sm"
                  >
                    <span className="font-mono text-[10px] text-ink-faint">{b.zettelId}</span>
                    <span className="truncate">{b.title}</span>
                  </button>
                </li>
              ))}
              {selected.backlinks.length === 0 && (
                <li className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-faint">
                  Nothing links here yet.
                </li>
              )}
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-faint">
        <FileTextIcon width={26} height={26} />
      </div>
      <p className="mb-4 text-sm text-ink-muted">Your vault is empty — create the first note to get started.</p>
      <Button variant="primary" onClick={onCreate}>
        <PlusIcon />
        <span>+ New note</span>
      </Button>
    </div>
  );
}
