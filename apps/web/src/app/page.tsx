"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { useEffect, useRef, useState } from "react";
import { NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher } from "../components/QuickSwitcher";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/session";
import { trpc } from "../lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type NoteDetail = RouterOutputs["note"]["getById"];
type KnowledgeBase = RouterOutputs["knowledgeBase"]["list"][number];
type NoteType = NoteListItem["type"];

const TYPE_STYLES: Record<NoteType, string> = {
  fleeting: "bg-surface-2 text-ink-muted border-line",
  literature: "bg-accent-2-soft text-accent-2 border-accent-2",
  permanent: "bg-accent-soft text-accent-ink border-accent",
  structure: "bg-surface-2 text-ink-muted border-line border-dashed",
};

export default function Home() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(Boolean(getAccessToken())), []);

  return authed ? (
    <Vault
      onLogout={() => {
        clearAccessToken();
        setAuthed(false);
      }}
    />
  ) : (
    <Auth onAuthed={() => setAuthed(true)} />
  );
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
      setAccessToken(result.accessToken);
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
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    trpc.knowledgeBase.list.query().then((kbs) => setKb(kbs[0] ?? null));
  }, []);

  async function refreshNotes(kbId: string) {
    setNotes(await trpc.note.list.query({ kbId }));
  }

  useEffect(() => {
    if (kb) refreshNotes(kb.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb]);

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
    if (kb) refreshNotes(kb.id);
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

  async function createNote(title = "Untitled") {
    if (!kb) return;
    await flushPending();
    const note = await trpc.note.create.mutate({ kbId: kb.id, title, content: "", type: "fleeting" });
    await refreshNotes(kb.id);
    setSelected(await trpc.note.getById.query({ id: note.id }));
    setSaveStatus("saved");
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }

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
        <div className="mb-1 flex items-baseline justify-between">
          <span className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-muted">
            {kb?.name ?? "VaultVista"} ▾
          </span>
          <button onClick={onLogout} className="font-mono text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted">
            Log out
          </button>
        </div>

        <button
          onClick={() => setSwitcherOpen(true)}
          className="mt-4 flex items-center justify-between rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-faint hover:border-accent"
        >
          Jump to…
          <span className="font-mono text-[10px]">⌘K</span>
        </button>
        <button
          onClick={() => createNote()}
          className="mt-2 rounded-md border border-accent px-3 py-1.5 text-left text-sm font-medium text-accent-ink hover:bg-accent-soft"
        >
          + New note
        </button>

        <div className="mt-5 flex-1 overflow-y-auto">
          <div className="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
            {notes.length} note{notes.length === 1 ? "" : "s"}
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
              />
            </div>
          ) : (
            <EmptyState onCreate={() => createNote()} />
          )}
        </div>

        {selected && (
          <aside className="w-72 flex-none overflow-y-auto border-l border-line bg-surface px-5 py-6">
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
          notes={notes}
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
