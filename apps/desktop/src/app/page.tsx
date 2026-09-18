"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "../components/GraphView";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  HashIcon,
  LayersIcon,
  LinkIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
} from "../components/icons";
import { NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher } from "../components/QuickSwitcher";
import { Button, Chip, Kbd, SaveStatusIndicator } from "../components/ui";
import { showVaultLocation, vaultClient } from "../lib/vaultClient";

type NoteType = "fleeting" | "literature" | "permanent" | "structure";
interface NoteListItem {
  id: string;
  zettelId: string;
  title: string;
  type: NoteType;
  updatedAt: string;
}
interface NoteDetail {
  id: string;
  zettelId: string;
  title: string;
  content: string;
  type: NoteType;
  tagNames: string[];
  backlinks: { noteId: string; title: string; zettelId: string }[];
  contents: { noteId: string | null; title: string; zettelId: string | null; resolved: boolean }[];
}
interface TagItem {
  id: string;
  name: string;
  noteCount: number;
}
interface GraphData {
  nodes: { id: string; title: string; zettelId: string; type: NoteType }[];
  edges: { source: string; target: string }[];
}
interface SearchResultItem {
  id: string;
  title: string;
  zettelId: string;
  snippet: string;
}

const TYPE_STYLES: Record<NoteType, string> = {
  fleeting: "bg-surface-2 text-ink-muted border-line",
  literature: "bg-accent-2-soft text-accent-2 border-accent-2/40",
  permanent: "bg-accent-soft text-accent-ink border-accent/40",
  structure: "bg-surface-2 text-ink-muted border-line border-dashed",
};

export default function Home() {
  return <Vault />;
}

type SaveStatus = "idle" | "saving" | "saved";
interface PendingSave {
  id: string;
  title: string;
  content: string;
  type: NoteType;
}

function Vault() {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  // Structure notes are Simplekasten's Maps of Content — a curated table of
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

  useEffect(() => {
    vaultClient.getVaultPath().then(setVaultPath);
  }, []);

  async function chooseFolder() {
    const path = await vaultClient.chooseVaultFolder();
    setVaultPath(path);
    setSelected(null);
    // A tag filter from the old vault would filter the new one by a tag that
    // likely doesn't exist there — an empty list with no obvious cause. Clear
    // it, and let the new vault's first note auto-open again.
    setActiveTag(null);
    hasAutoOpenedRef.current = false;
    // Still needed explicitly: if activeTag was already null, the [activeTag]
    // effect won't re-fire.
    refreshNotes();
    refreshTags();
  }

  const vaultName = vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? "Simplekasten";

  async function refreshNotes(tag?: string | null) {
    setNotes((await vaultClient.listNotes(tag ?? undefined)) as NoteListItem[]);
  }

  async function refreshTags() {
    setTags((await vaultClient.listTags()) as TagItem[]);
  }

  useEffect(() => {
    refreshNotes(activeTag);
    refreshTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #hashtags are parsed from note content, so the tag list can change on
  // every save — re-filtering here keeps the sidebar list honest without a
  // full page reload.
  useEffect(() => {
    refreshNotes(activeTag);
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
    await vaultClient.updateNote(payload);
    setSaveStatus("saved");
    refreshNotes(activeTag);
    refreshTags();
    // Saving can change this note's own resolved backlinks (a title edit can
    // resolve a link another note was waiting on) or its tags (a content
    // edit can add/remove #hashtags) — refresh just those derived fields so
    // the open panels don't go stale until the user navigates away and back.
    const fresh = (await vaultClient.getNoteById(payload.id)) as NoteDetail;
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
    setSelected((await vaultClient.getNoteById(id)) as NoteDetail);
    setSaveStatus("saved");
  }

  async function openGraph() {
    setGraphData((await vaultClient.getGraph()) as GraphData);
  }

  async function showVault() {
    await showVaultLocation();
  }

  async function createNote(title = "Untitled") {
    await flushPending();
    // createNote returns a VaultNote, not a NoteDetail — only .id is used here.
    const note = (await vaultClient.createNote({ title, content: "", type: "fleeting" })) as { id: string };
    await refreshNotes();
    justCreatedIdRef.current = note.id;
    setSelected((await vaultClient.getNoteById(note.id)) as NoteDetail);
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
        <div className="mb-3">
          <div className="truncate px-2 py-1.5 text-sm font-semibold text-ink">{vaultName}</div>
          <div className="mt-1 flex flex-col gap-1">
            <button
              onClick={chooseFolder}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Choose vault folder…
            </button>
            <button
              onClick={showVault}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <DownloadIcon />
              Show vault location
            </button>
          </div>
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
          onSearch={(query) => vaultClient.search(query) as Promise<SearchResultItem[]>}
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
