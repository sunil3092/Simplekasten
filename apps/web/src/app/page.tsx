"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { useEffect, useState } from "react";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/session";
import { trpc } from "../lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type NoteDetail = RouterOutputs["note"]["getById"];
type KnowledgeBase = RouterOutputs["knowledgeBase"]["list"][number];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(Boolean(getAccessToken())), []);

  return authed ? <Vault onLogout={() => { clearAccessToken(); setAuthed(false); }} /> : <Auth onAuthed={() => setAuthed(true)} />;
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
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>VaultVista</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "register" && (
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {error && <p style={{ color: "#9c4a3c", fontSize: 13 }}>{error}</p>}
        <button type="submit">{mode === "login" ? "Log in" : "Create account"}</button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: 12, background: "none", border: "none", textDecoration: "underline" }}>
        {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
      </button>
    </main>
  );
}

function Vault({ onLogout }: { onLogout: () => void }) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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
    const note = await trpc.note.create.mutate({ kbId: kb.id, title, content, type: "fleeting" });
    setTitle("");
    setContent("");
    await refreshNotes(kb.id);
    openNote(note.id);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 240, borderRight: "1px solid #ddd", padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong>{kb?.name ?? "VaultVista"}</strong>
          <button onClick={onLogout} style={{ fontSize: 12, background: "none", border: "none", textDecoration: "underline" }}>
            Log out
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => openNote(n.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 4px", background: "none", border: "none" }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.6 }}>{n.zettelId}</span> {n.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <form onSubmit={createNote} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32, maxWidth: 520 }}>
          <input placeholder="New note title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            placeholder="Write here. Use [[Another Note]] to link — it works even before that note exists."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <button type="submit">+ New note</button>
        </form>

        {selected && (
          <article style={{ maxWidth: 520 }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.6 }}>{selected.zettelId} · {selected.type}</div>
            <h2>{selected.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.content}</p>

            <h3 style={{ fontSize: 14, marginTop: 32 }}>Linked mentions ({selected.backlinks.length})</h3>
            <ul>
              {selected.backlinks.map((b) => (
                <li key={b.noteId}>
                  <button onClick={() => openNote(b.noteId)} style={{ background: "none", border: "none", textDecoration: "underline" }}>
                    {b.title}
                  </button>
                </li>
              ))}
              {selected.backlinks.length === 0 && <li style={{ opacity: 0.5 }}>Nothing links here yet.</li>}
            </ul>
          </article>
        )}
      </main>
    </div>
  );
}
