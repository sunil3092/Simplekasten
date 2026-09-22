"use client";

import { COPY } from "@simplekasten/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Attachments, type AttachmentItem } from "../components/Attachments";
import { GraphView } from "../components/GraphView";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  HashIcon,
  LayersIcon,
  LinkIcon,
  NetworkIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "../components/icons";
import { NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher } from "../components/QuickSwitcher";
import { SettingsModal } from "../components/SettingsModal";
import { Button, Chip, ConfirmDialog, IconButton, Kbd, NoteLink, SaveStatusIndicator, SectionHeading } from "../components/ui";
import { badgeClasses, NOTE_TYPES, type NoteType } from "../lib/noteTypes";
import { useTheme } from "../lib/ThemeProvider";
import { showVaultLocation, vaultClient } from "../lib/vaultClient";

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
  noteDate: string | null;
  tagNames: string[];
  attachments: AttachmentItem[];
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
  const [dailyNotes, setDailyNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const { notice: themeNotice } = useTheme();
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

  async function refreshDailyNotes() {
    setDailyNotes((await vaultClient.listDailyNotes()) as NoteListItem[]);
  }

  useEffect(() => {
    refreshNotes(activeTag);
    refreshTags();
    refreshDailyNotes();
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
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        openDaily(todayLocal());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "en-CA" is a locale-format trick that happens to render YYYY-MM-DD in
  // the browser's local time — not a hardcoded region. The date has to be
  // computed client-side: the engine has no notion of the user's timezone,
  // and "today" is inherently local to the device.
  function todayLocal(): string {
    return new Date().toLocaleDateString("en-CA");
  }

  function shiftDate(date: string, days: number): string {
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + days));
    return next.toISOString().slice(0, 10);
  }

  async function openDaily(date: string) {
    await flushPending();
    setAttachmentError(null);
    const note = (await vaultClient.getOrCreateDailyNote(date)) as { id: string };
    setSelected((await vaultClient.getNoteById(note.id)) as NoteDetail);
    setSaveStatus("saved");
    refreshNotes(activeTag);
    refreshDailyNotes();
  }

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
        ? { ...current, backlinks: fresh.backlinks, tagNames: fresh.tagNames, contents: fresh.contents, attachments: fresh.attachments }
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
    setAttachmentError(null);
    setSelected((await vaultClient.getNoteById(id)) as NoteDetail);
    setSaveStatus("saved");
  }

  async function deleteSelected() {
    if (!selected) return;
    setConfirmingDelete(false);
    await flushPending();
    const deletedId = selected.id;
    await vaultClient.deleteNote(deletedId);
    const remaining = ((await vaultClient.listNotes(activeTag ?? undefined)) as NoteListItem[]).filter((n) => n.id !== deletedId);
    setNotes(remaining);
    refreshTags();
    if (remaining.length > 0) await openNote(remaining[0].id);
    else setSelected(null);
  }

  async function refreshAttachments(id: string) {
    const fresh = (await vaultClient.getNoteById(id)) as NoteDetail;
    setSelected((current) => (current && current.id === id ? { ...current, attachments: fresh.attachments } : current));
  }

  async function addAttachment() {
    if (!selected) return;
    const id = selected.id;
    setAttachmentError(null);
    try {
      await flushPending();
      if (await vaultClient.addAttachment(id)) await refreshAttachments(id);
    } catch {
      setAttachmentError("Couldn't attach that file — only images and audio are supported.");
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!selected) return;
    await vaultClient.deleteAttachment(attachmentId);
    await refreshAttachments(selected.id);
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
      <aside className="flex w-64 flex-none flex-col border-r-(length:--border-w) border-line bg-surface px-3.5 py-4">
        <div className="mb-3">
          <div className="truncate px-2 py-1.5 text-sm font-semibold text-ink">{vaultName}</div>
          <div className="mt-1 flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={chooseFolder}>
              Choose vault folder…
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={showVault}>
              <DownloadIcon />
              Show vault location
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button className="relative w-full justify-start" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
            Settings
            {themeNotice && (
              <span aria-label="Theme problem" className="absolute top-1/2 right-3 h-2 w-2 -translate-y-1/2 rounded-full bg-accent-2" />
            )}
          </Button>
          <Button className="w-full" onClick={() => setSwitcherOpen(true)}>
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <SearchIcon />
                Jump to…
              </span>
              <Kbd>⌘K</Kbd>
            </span>
          </Button>
          <Button className="w-full justify-start" onClick={() => openDaily(todayLocal())}>
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon />
                Today
              </span>
              <Kbd>⌘J</Kbd>
            </span>
          </Button>
          <Button className="w-full justify-start" onClick={openGraph}>
            <NetworkIcon />
            Graph view
          </Button>
          <Button variant="primary" className="w-full justify-start" onClick={() => createNote()}>
            <PlusIcon />
            {COPY.newNote}
          </Button>
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
            <SectionHeading compact icon={<LayersIcon />} className="mb-1.5">
              {COPY.mapsOfContent}
            </SectionHeading>
            <ul className="flex flex-col gap-1">
              {mapsOfContent.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNote(n.id)}
                    className={`block w-full rounded-lg border-(length:--border-w) border-dashed px-2.5 py-1.5 text-left text-sm transition-colors ${
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

        {dailyNotes.length > 0 && (
          <div className="mt-4">
            <SectionHeading compact icon={<CalendarIcon />} className="mb-1.5">
              Journal
            </SectionHeading>
            <ul className="flex flex-col gap-1" data-testid="journal-list">
              {dailyNotes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNote(n.id)}
                    className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      n.id === selected?.id ? "bg-accent-soft text-accent-ink" : "text-ink-muted hover:bg-surface-2"
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
            <span>{COPY.noteCount(notes.length, activeTag)}</span>
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
                  className={`flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
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
            <div className="mx-auto max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="relative">
                  <select
                    value={selected.type}
                    onChange={(e) => updateType(e.target.value as NoteType)}
                    className={`appearance-none rounded-md border-(length:--border-w) py-1 pr-6 pl-2.5 font-mono text-[10px] font-medium tracking-wide uppercase transition-colors focus:outline-none ${badgeClasses(selected.type)}`}
                  >
                    {NOTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 opacity-60" />
                </div>
                <span className="font-mono text-xs text-ink-faint">{selected.zettelId}</span>
                {selected.type === "daily" && selected.noteDate && (
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      aria-label="Previous day"
                      title="Previous day"
                      onClick={() => openDaily(shiftDate(selected.noteDate!, -1))}
                    >
                      <ChevronLeftIcon />
                    </IconButton>
                    <IconButton
                      aria-label="Next day"
                      title="Next day"
                      onClick={() => openDaily(shiftDate(selected.noteDate!, 1))}
                    >
                      <ChevronRightIcon />
                    </IconButton>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  {selected.tagNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => toggleTag(name)}
                      className="inline-flex items-center gap-0.5 rounded-full border-(length:--border-w) border-line px-2 py-0.5 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent-2 hover:text-accent-2"
                    >
                      <HashIcon />
                      {name}
                    </button>
                  ))}
                </div>
                <span className="ml-auto flex items-center gap-1">
                  <SaveStatusIndicator status={saveStatus} />
                  <IconButton aria-label="Attach a photo or audio file" title="Attach a photo or audio file" onClick={addAttachment} className="ml-2">
                    <PaperclipIcon />
                  </IconButton>
                  <IconButton aria-label="Delete note" title="Delete note" onClick={() => setConfirmingDelete(true)} className="hover:text-danger">
                    <TrashIcon />
                  </IconButton>
                </span>
              </div>

              <input
                ref={titleInputRef}
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="font-display mb-5 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-faint"
                placeholder={COPY.titlePlaceholder}
              />

              <NoteEditor
                key={selected.id}
                initialValue={selected.content}
                onChange={updateContent}
                onNavigateLink={navigateToTitle}
                onTagClick={toggleTag}
                noteTitles={notes.filter((n) => n.id !== selected.id).map((n) => n.title)}
              />

              {attachmentError && (
                <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {attachmentError}
                </p>
              )}
              <Attachments attachments={selected.attachments} onRemove={removeAttachment} />
            </div>
          ) : (
            <EmptyState onCreate={() => createNote()} />
          )}
        </div>

        {selected && (
          <aside className="w-72 flex-none overflow-y-auto border-l-(length:--border-w) border-line bg-surface px-5 py-6">
            <SectionHeading icon={selected.type === "structure" ? <LayersIcon /> : <NetworkIcon />}>
              {selected.type === "structure" ? "Contents" : "Links"} ({selected.contents.length})
            </SectionHeading>
            <ul className="mb-6 flex flex-col gap-2">
              {selected.contents.map((item, i) => (
                <li key={item.noteId ?? `${item.title}-${i}`}>
                  <NoteLink
                    zettelId={item.zettelId}
                    title={item.title}
                    unresolved={!item.resolved}
                    onClick={() => navigateToTitle(item.title)}
                  />
                </li>
              ))}
              {selected.contents.length === 0 && (
                <li className="rounded-lg border-(length:--border-w) border-dashed border-line px-3 py-4 text-center text-sm text-ink-faint">
                  {COPY.noLinks}
                </li>
              )}
            </ul>
            <SectionHeading icon={<LinkIcon />}>
              {COPY.linkedMentions} ({selected.backlinks.length})
            </SectionHeading>
            <ul className="flex flex-col gap-2">
              {selected.backlinks.map((b) => (
                <li key={b.noteId}>
                  <NoteLink zettelId={b.zettelId} title={b.title} onClick={() => openNote(b.noteId)} />
                </li>
              ))}
              {selected.backlinks.length === 0 && (
                <li className="rounded-lg border-(length:--border-w) border-dashed border-line px-3 py-4 text-center text-sm text-ink-faint">
                  {COPY.noBacklinks}
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

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {confirmingDelete && selected && (
        <ConfirmDialog
          title={COPY.deleteNoteTitle}
          body={COPY.deleteNoteBody(selected.title)}
          confirmLabel="Delete"
          onConfirm={deleteSelected}
          onCancel={() => setConfirmingDelete(false)}
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
      <p className="mb-4 text-sm text-ink-muted">{COPY.emptyVault}</p>
      <Button variant="primary" onClick={onCreate}>
        <PlusIcon />
        {COPY.newNote}
      </Button>
    </div>
  );
}
