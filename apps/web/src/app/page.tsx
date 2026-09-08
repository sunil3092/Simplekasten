"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { useEffect, useRef, useState } from "react";
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
              className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
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

function Vault({ onLogout }: { onLogout: () => void }) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("fleeting");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trpc.knowledgeBase.list.query().then((kbs) => setKb(kbs[0] ?? null));
  }, []);

  async function refreshNotes(kbId: string) {
    setNotes(await trpc.note.list.query({ kbId }));
  }

  useEffect(() => {
    if (kb) refreshNotes(kb.id);
  }, [kb]);

  async function openNote(id: string) {
    setSelected(await trpc.note.getById.query({ id }));
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!kb || !title.trim()) return;
    const note = await trpc.note.create.mutate({ kbId: kb.id, title, content, type });
    setTitle("");
    setContent("");
    setType("fleeting");
    await refreshNotes(kb.id);
    openNote(note.id);
  }

  return (
    <div className="flex h-screen bg-bg">
      <aside className="flex w-64 flex-none flex-col border-r border-line bg-surface px-4 py-5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="rounded-md border border-line bg-white px-2.5 py-1 font-mono text-xs text-ink-muted">
            {kb?.name ?? "VaultVista"} ▾
          </span>
          <button onClick={onLogout} className="font-mono text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted">
            Log out
          </button>
        </div>

        <button
          onClick={() => titleInputRef.current?.focus()}
          className="mt-4 rounded-md border border-accent px-3 py-1.5 text-left text-sm font-medium text-accent-ink hover:bg-accent-soft"
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

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <form onSubmit={createNote} className="mb-10 max-w-xl rounded-lg border border-line bg-surface p-4">
          <input
            ref={titleInputRef}
            className="w-full border-none bg-transparent font-display text-lg font-semibold text-ink outline-none placeholder:text-ink-faint"
            placeholder="New note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="mt-2 w-full resize-none border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            placeholder="Write here. Use [[Another Note]] to link — it works even before that note exists."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NoteType)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-ink-muted"
            >
              <option value="fleeting">Fleeting</option>
              <option value="literature">Literature</option>
              <option value="permanent">Permanent</option>
              <option value="structure">Structure</option>
            </select>
            <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-ink">
              + New note
            </button>
          </div>
        </form>

        {selected && (
          <article className="max-w-xl">
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${TYPE_STYLES[selected.type]}`}>
                {selected.type}
              </span>
              <span className="font-mono text-xs text-ink-faint">{selected.zettelId}</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-ink">{selected.title}</h2>
            <p className="mt-3 leading-relaxed whitespace-pre-wrap text-ink">{selected.content}</p>

            <h3 className="mt-8 mb-2 font-mono text-xs tracking-wide text-ink-faint uppercase">
              Linked mentions ({selected.backlinks.length})
            </h3>
            <ul className="flex flex-col gap-1">
              {selected.backlinks.map((b) => (
                <li key={b.noteId}>
                  <button
                    onClick={() => openNote(b.noteId)}
                    className="text-sm text-accent-ink underline underline-offset-2 hover:text-accent"
                  >
                    {b.title}
                  </button>
                </li>
              ))}
              {selected.backlinks.length === 0 && <li className="text-sm text-ink-faint">Nothing links here yet.</li>}
            </ul>
          </article>
        )}
      </main>
    </div>
  );
}
