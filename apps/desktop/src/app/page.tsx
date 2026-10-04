"use client";

import { COPY } from "@simplekasten/core";
// These describe what the vault engine returns over the preload bridge, so
// they come from the engine itself rather than being restated here.
import type {
  CanvasListItem,
  GraphData,
  NoteDetail,
  NoteListItem,
  ReviewRating,
  TagItem,
  Template,
} from "@simplekasten/local-engine";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Attachments } from "../components/Attachments";
import { GraphView } from "../components/GraphView";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FlowIcon,
  HashIcon,
  HistoryIcon,
  LayersIcon,
  LayoutIcon,
  LinkIcon,
  NetworkIcon,
  PaperclipIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "../components/icons";
import { CanvasView } from "../components/CanvasView";
import { FlowView } from "../components/FlowView";
import { ReviewSession } from "../components/ReviewSession";
import { TemplatesModal } from "../components/TemplatesModal";
import { VersionHistoryModal } from "../components/VersionHistoryModal";
import { moveToEditorOnKey, NoteEditor } from "../components/NoteEditor";
import { QuickSwitcher, type CommandItem } from "../components/QuickSwitcher";
import { TagPicker } from "../components/TagPicker";
import { SettingsModal } from "../components/SettingsModal";
import {
  Button,
  Chip,
  ConfirmDialog,
  IconButton,
  ShortcutHint,
  NoteLink,
  PromptDialog,
  SaveStatusIndicator,
  SectionHeading,
} from "../components/ui";
import { badgeClasses, NOTE_TYPES, type NoteType } from "../lib/noteTypes";
import { useTheme } from "../lib/ThemeProvider";
import { loadNote, showVaultLocation, vaultClient } from "../lib/vaultClient";

function SidebarDisclosure({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open className={`group ${className}`}>
      <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 font-mono text-[10px] font-medium tracking-wider text-ink-faint uppercase hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {icon}
          {title}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 flex-none transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
  const [openCanvasId, setOpenCanvasId] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  // Non-null while a review session is open; holds the due notes fetched at
  // session start so rating through the queue doesn't reshuffle mid-session
  // if a note's due date happens to land on today from elsewhere.
  const [reviewQueue, setReviewQueue] = useState<NoteListItem[] | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewNote, setReviewNote] = useState<NoteDetail | null>(null);
  // NoteEditor is uncontrolled by design (see its own comment) — it only
  // reads initialValue on mount, so an external content change made outside
  // typing (applying a template) needs a remount to become visible. Bumped
  // only there, never on normal edits, which stay uncontrolled for cursor
  // stability.
  const [editorNonce, setEditorNonce] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [namingCanvas, setNamingCanvas] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const { notice: themeNotice } = useTheme();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [flowData, setFlowData] = useState<GraphData | null>(null);
  // Structure notes are Simplekasten's Maps of Content — a curated table of
  // contents you link into rather than a folder you file things under.
  // Surfacing them as a standing sidebar section is what makes folder-free
  // navigation actually work: without this, an index note is no different
  // from any other note once it scrolls out of the recent-notes list.
  const mapsOfContent = useMemo(
    () => notes.filter((n) => n.type === "structure"),
    [notes],
  );
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

  const vaultName =
    vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? "Simplekasten";

  async function refreshNotes(tag?: string | null) {
    setNotes(await vaultClient.listNotes(tag ?? undefined));
  }

  async function refreshTags() {
    setTags(await vaultClient.listTags());
  }

  async function refreshDailyNotes() {
    setDailyNotes(await vaultClient.listDailyNotes());
  }

  async function refreshTemplates() {
    setTemplates(await vaultClient.listTemplates());
  }

  async function refreshDueCount() {
    setDueCount(
      (await vaultClient.listDueForReview(todayLocal())).length,
    );
  }

  async function refreshCanvases() {
    setCanvases(await vaultClient.listCanvases());
  }

  useEffect(() => {
    refreshNotes(activeTag);
    refreshTags();
    refreshDailyNotes();
    refreshTemplates();
    refreshDueCount();
    refreshCanvases();
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
    const note = await vaultClient.getOrCreateDailyNote(date);
    setSelected(await loadNote(note.id));
    setSaveStatus("saved");
    refreshNotes(activeTag);
    refreshDailyNotes();
    // A new daily note brings the journal tag with it.
    refreshTags();
  }

  async function createTemplate(input: { name: string; content: string }) {
    await vaultClient.createTemplate(input);
    await refreshTemplates();
  }

  async function updateTemplateEntry(input: {
    id: string;
    name?: string;
    content?: string;
  }) {
    await vaultClient.updateTemplate(input);
    await refreshTemplates();
  }

  async function deleteTemplateEntry(id: string) {
    await vaultClient.deleteTemplate(id);
    await refreshTemplates();
  }

  async function setDefaultTemplate(id: string) {
    await vaultClient.setDefaultForDailyNote(id);
    await refreshTemplates();
  }

  async function applyTemplate(templateId: string) {
    if (!selected) return;
    setTemplateMenuOpen(false);
    await flushPending();
    const updated = await vaultClient.applyTemplate({
      noteId: selected.id,
      templateId,
    });
    setSelected(updated);
    setEditorNonce((n) => n + 1);
  }

  async function toggleReviewQueue() {
    if (!selected) return;
    if (selected.reviewDue)
      await vaultClient.removeFromReviewQueue(selected.id);
    else await vaultClient.addToReviewQueue(selected.id, todayLocal());
    setSelected(await loadNote(selected.id));
    refreshDueCount();
  }

  async function openReview() {
    const due = await vaultClient.listDueForReview(todayLocal());
    setReviewQueue(due);
    setReviewIndex(0);
    setReviewNote(
      due.length > 0
        ? await loadNote(due[0].id)
        : null,
    );
  }

  function closeReview() {
    setReviewQueue(null);
    setReviewNote(null);
  }

  async function rateReviewNote(rating: ReviewRating) {
    if (!reviewQueue || !reviewNote) return;
    await vaultClient.submitReview({
      noteId: reviewNote.id,
      rating,
      today: todayLocal(),
    });
    const nextIndex = reviewIndex + 1;
    setReviewIndex(nextIndex);
    setReviewNote(
      nextIndex < reviewQueue.length
        ? await loadNote(reviewQueue[nextIndex].id)
        : null,
    );
    refreshDueCount();
    if (selected && selected.id === reviewNote.id)
      setSelected(await loadNote(selected.id));
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
    const fresh = await loadNote(payload.id);
    setSelected((current) =>
      current && current.id === payload.id
        ? {
            ...current,
            backlinks: fresh.backlinks,
            tagNames: fresh.tagNames,
            assignedTags: fresh.assignedTags,
            contents: fresh.contents,
            attachments: fresh.attachments,
          }
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
    // The only place a note id can be stale: it comes from a list, a
    // backlink, a search result, a canvas card or a flow node, any of which
    // can still name a note deleted since. Clearing the selection is the
    // honest outcome there, so this one reads the nullable result directly
    // instead of going through loadNote.
    setSelected(await vaultClient.getNoteById(id));
    setSaveStatus("saved");
  }

  async function deleteSelected() {
    if (!selected) return;
    setConfirmingDelete(false);
    await flushPending();
    const deletedId = selected.id;
    await vaultClient.deleteNote(deletedId);
    const remaining = (
      await vaultClient.listNotes(activeTag ?? undefined)
    ).filter((n) => n.id !== deletedId);
    setNotes(remaining);
    refreshTags();
    if (remaining.length > 0) await openNote(remaining[0].id);
    else setSelected(null);
  }

  async function updateTags(assignedTags: string[]) {
    if (!selected) return;
    const id = selected.id;
    // Optimistic, so the checkbox flips at once; the engine's answer (which
    // merges in #hashtags) replaces it right after.
    setSelected((current) =>
      current && current.id === id ? { ...current, assignedTags } : current,
    );
    await flushPending();
    setSaveStatus("saving");
    await vaultClient.updateNote({ id, tags: assignedTags });
    setSaveStatus("saved");
    const fresh = await loadNote(id);
    setSelected((current) =>
      current && current.id === id
        ? {
            ...current,
            tagNames: fresh.tagNames,
            assignedTags: fresh.assignedTags,
          }
        : current,
    );
    refreshTags();
    refreshNotes(activeTag);
  }

  async function refreshAttachments(id: string) {
    const fresh = await loadNote(id);
    setSelected((current) =>
      current && current.id === id
        ? { ...current, attachments: fresh.attachments }
        : current,
    );
  }

  async function addAttachment() {
    if (!selected) return;
    const id = selected.id;
    setAttachmentError(null);
    try {
      await flushPending();
      if (await vaultClient.addAttachment(id)) await refreshAttachments(id);
    } catch {
      setAttachmentError(
        "Couldn't attach that file — only images and audio are supported.",
      );
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!selected) return;
    await vaultClient.deleteAttachment(attachmentId);
    await refreshAttachments(selected.id);
  }

  async function openGraph() {
    setGraphData(await vaultClient.getGraph());
  }

  // Prototype: same data Graph view uses, read as a top-to-bottom layered
  // diagram instead — see packages/local-engine/src/flow-layout.ts.
  async function openFlow() {
    setFlowData(await vaultClient.getGraph());
  }

  // Re-reads links and notes for an open flow view. A save can still land
  // just after the view closes; that must not bring it back.
  async function refreshFlow() {
    const graph = await vaultClient.getGraph();
    setFlowData((current) => (current ? graph : current));
  }

  // Edits made on flow cards have to reach everything else that shows the
  // note: the note list, the tag list, and the editor if it has it open.
  async function saveNoteFromFlow(input: {
    id: string;
    title?: string;
    content?: string;
    type?: NoteType;
  }) {
    await vaultClient.updateNote(input);
    const fresh = await loadNote(input.id);
    refreshNotes(activeTag);
    refreshTags();
    // A type change can add or remove a journal entry or a map of content.
    if (input.type !== undefined) refreshDailyNotes();
    refreshFlow();
    if (selected?.id === input.id) {
      setSelected(fresh);
      setEditorNonce((n) => n + 1);
    }
    return { tags: fresh.tagNames };
  }

  async function createNoteFromFlow() {
    const note = await createNoteForCanvas("Untitled");
    await refreshFlow();
    return note;
  }

  async function deleteNoteFromFlow(id: string) {
    await vaultClient.deleteNote(id);
    if (selected?.id === id) setSelected(null);
    refreshNotes(activeTag);
    refreshTags();
    refreshDailyNotes();
    refreshDueCount();
    await refreshFlow();
  }

  async function vaultSummary() {
    const [allNotes, allCanvases, allTemplates] = await Promise.all([
      vaultClient.listNotes(),
      vaultClient.listCanvases(),
      vaultClient.listTemplates(),
    ]);
    return {
      notes: allNotes.length,
      canvases: allCanvases.length,
      templates: allTemplates.length,
    };
  }

  async function purgeVault() {
    // An edit still waiting to be saved would write its note straight back
    // into the emptied vault — drop it rather than flush it.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;

    await vaultClient.purgeVault();

    setSelected(null);
    setActiveTag(null);
    setSaveStatus("saved");
    // Card positions belong to notes that no longer exist.
    try {
      window.localStorage.removeItem(`simplekasten.flow-positions:${vaultPath}`);
    } catch {
      // nothing to clear
    }
    await Promise.all([
      refreshNotes(),
      refreshTags(),
      refreshDailyNotes(),
      refreshTemplates(),
      refreshDueCount(),
      refreshCanvases(),
    ]);
    setSettingsOpen(false);
  }

  async function showVault() {
    await showVaultLocation();
  }

  async function createCanvas(title: string) {
    setNamingCanvas(false);
    const canvas = await vaultClient.createCanvas({
      title: title.trim() || "Untitled canvas",
    });
    await refreshCanvases();
    setOpenCanvasId(canvas.id);
  }

  // Creates a note for a canvas card without navigating the main editor to
  // it — createNote() below opens the note it makes, which would close the
  // canvas the user is still working in.
  async function createNoteForCanvas(title: string): Promise<{ id: string }> {
    const note = await vaultClient.createNote({
      title,
      content: "",
      type: "fleeting",
    });
    await refreshNotes();
    return note;
  }

  async function createNote(title = "Untitled") {
    await flushPending();
    // createNote returns a VaultNote, not a NoteDetail — only .id is used here.
    const note = await vaultClient.createNote({
      title,
      content: "",
      type: "fleeting",
    });
    await refreshNotes();
    justCreatedIdRef.current = note.id;
    setSelected(await loadNote(note.id));
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
    const found = notes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase(),
    );
    if (found) await openNote(found.id);
    else await createNote(title);
  }

  function updateTitle(value: string) {
    if (!selected) return;
    const next = { ...selected, title: value };
    setSelected(next);
    scheduleSave({
      id: next.id,
      title: next.title,
      content: next.content,
      type: next.type,
    });
  }

  function updateContent(value: string) {
    if (!selected) return;
    const next = { ...selected, content: value };
    setSelected(next);
    scheduleSave({
      id: next.id,
      title: next.title,
      content: next.content,
      type: next.type,
    });
  }

  async function updateType(value: NoteType) {
    if (!selected) return;
    const next = { ...selected, type: value };
    setSelected(next);
    await flushPending();
    await save({
      id: next.id,
      title: next.title,
      content: next.content,
      type: next.type,
    });
  }

  // Every command here already exists as a handler above — this only makes
  // it reachable by typing ">" into the same Cmd/Ctrl+K switcher. Recomputed
  // each render (not memoized) so its closures never go stale, same as the
  // inline handlers already passed to QuickSwitcher below.
  const commands: CommandItem[] = [
    {
      id: "new-note",
      icon: "plus",
      label: "New note",
      description: "Create a new fleeting note",
      run: () => createNote(),
    },
    {
      id: "today",
      icon: "calendar",
      label: "Today",
      description: "Open or create today's daily note",
      run: () => openDaily(todayLocal()),
    },
    {
      id: "review",
      icon: "repeat",
      label: "Review",
      description: "Start a spaced-repetition review session",
      run: openReview,
    },
    {
      id: "templates",
      icon: "fileText",
      label: "Templates…",
      description: "Manage note templates",
      run: () => setTemplatesOpen(true),
    },
    {
      id: "graph",
      icon: "network",
      label: "Graph view",
      description: "Visualize how notes link together",
      run: openGraph,
    },
    {
      id: "flow",
      icon: "flow",
      label: "Flow view",
      description: "See related notes as a top-to-bottom flow diagram",
      run: openFlow,
    },
    {
      id: "settings",
      icon: "settings",
      label: "Settings",
      description: "Theme and appearance settings",
      run: () => setSettingsOpen(true),
    },
    {
      id: "choose-vault",
      icon: "download",
      label: "Choose vault folder…",
      description: "Switch to a different vault",
      run: chooseFolder,
    },
    {
      id: "show-vault",
      icon: "download",
      label: "Show vault location",
      description: "Reveal the vault's folder on disk",
      run: showVault,
    },
  ];

  return (
    <div className="flex h-screen bg-bg">
      <aside className="flex w-64 flex-none flex-col border-r-(length:--border-w) border-line bg-surface px-3.5 py-4">
        <div className="mb-3 border-b border-line-soft pb-3">
          <div className="truncate px-2 py-1.5 text-sm font-semibold text-ink">
            {vaultName}
          </div>
        </div>

        <div className="-mr-1.5 min-h-0 flex-1 overflow-y-auto pr-1.5">
          <div className="flex flex-col gap-3">
            <SidebarDisclosure title="Create">
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="primary"
                  className="w-full justify-start"
                  onClick={() => createNote()}
                >
                  <PlusIcon />
                  {COPY.newNote}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setNamingCanvas(true)}
                >
                  <LayoutIcon />
                  New canvas…
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setTemplatesOpen(true)}
                >
                  <FileTextIcon />
                  Templates…
                </Button>
              </div>
            </SidebarDisclosure>

            <SidebarDisclosure title="Navigate">
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSwitcherOpen(true)}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <SearchIcon />
                      Jump to…
                    </span>
                    <ShortcutHint letter="K" />
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => openDaily(todayLocal())}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarIcon />
                      Today
                    </span>
                    <ShortcutHint letter="J" />
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={openReview}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <RepeatIcon />
                      Review
                    </span>
                    {dueCount > 0 && (
                      <span
                        data-testid="review-due-count"
                        className="font-mono text-[10px] text-accent-ink"
                      >
                        {dueCount}
                      </span>
                    )}
                  </span>
                </Button>
              </div>
            </SidebarDisclosure>

            <SidebarDisclosure title="Views">
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={openGraph}
                >
                  <NetworkIcon />
                  Graph view
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={openFlow}
                >
                  <FlowIcon />
                  Flow view
                </Button>
              </div>
            </SidebarDisclosure>
          </div>

          {tags.length > 0 && (
            <SidebarDisclosure title={`Tags (${tags.length})`} className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Chip
                    key={t.id}
                    active={activeTag === t.name}
                    onClick={() => toggleTag(t.name)}
                  >
                    #{t.name} <span className="opacity-60">{t.noteCount}</span>
                  </Chip>
                ))}
              </div>
            </SidebarDisclosure>
          )}

          {mapsOfContent.length > 0 && (
            <SidebarDisclosure
              title={COPY.mapsOfContent}
              icon={<LayersIcon />}
              className="mt-3"
            >
              <ul className="flex flex-col gap-1">
                {mapsOfContent.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openNote(n.id)}
                      className={`block w-full rounded-lg border-(length:--border-w) border-dashed px-2.5 py-1.5 text-left text-sm transition-colors ${
                        n.id === selected?.id
                          ? "border-accent bg-accent-soft text-accent-ink"
                          : "border-line text-ink-muted hover:border-accent/50"
                      }`}
                    >
                      {n.title}
                    </button>
                  </li>
                ))}
              </ul>
            </SidebarDisclosure>
          )}

          {canvases.length > 0 && (
            <SidebarDisclosure
              title="Canvases"
              icon={<LayoutIcon />}
              className="mt-3"
            >
              <ul className="flex flex-col gap-1">
                {canvases.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setOpenCanvasId(c.id)}
                      className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            </SidebarDisclosure>
          )}

          {dailyNotes.length > 0 && (
            <SidebarDisclosure
              title="Journal"
              icon={<CalendarIcon />}
              className="mt-3"
            >
              <ul className="flex flex-col gap-1" data-testid="journal-list">
                {dailyNotes.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openNote(n.id)}
                      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                        n.id === selected?.id
                          ? "bg-accent-soft text-accent-ink"
                          : "text-ink-muted hover:bg-surface-2"
                      }`}
                    >
                      {n.title}
                    </button>
                  </li>
                ))}
              </ul>
            </SidebarDisclosure>
          )}

          <div className="mt-3">
            <SidebarDisclosure title={COPY.noteCount(notes.length, activeTag)}>
              {activeTag && (
                <div className="flex justify-end px-2 pb-1">
                  <button
                    onClick={() => setActiveTag(null)}
                    className="text-xs text-ink-faint transition-colors hover:text-ink-muted"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {notes.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openNote(n.id)}
                      className={`flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
                        selected?.id === n.id
                          ? "bg-accent-soft text-accent-ink"
                          : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <span className="font-mono text-[11px] text-ink-faint">
                        {n.zettelId}
                      </span>
                      <span className="truncate">{n.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SidebarDisclosure>
          </div>
        </div>

        <div className="mt-3 shrink-0 border-t border-line-soft pt-3">
          <Button
            variant="ghost"
            className="relative w-full justify-start"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
            Settings
            {themeNotice && (
              <span
                aria-label="Theme problem"
                className="absolute top-1/2 right-3 h-2 w-2 -translate-y-1/2 rounded-full bg-accent-2"
              />
            )}
          </Button>
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
                <TagPicker
                  vaultTags={tags}
                  assigned={selected.assignedTags}
                  onNote={selected.tagNames}
                  onChange={updateTags}
                />
                <span className="font-mono text-xs text-ink-faint">
                  {selected.zettelId}
                </span>
                {selected.type === "daily" && selected.noteDate && (
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      aria-label="Previous day"
                      title="Previous day"
                      onClick={() =>
                        openDaily(shiftDate(selected.noteDate!, -1))
                      }
                    >
                      <ChevronLeftIcon />
                    </IconButton>
                    <IconButton
                      aria-label="Next day"
                      title="Next day"
                      onClick={() =>
                        openDaily(shiftDate(selected.noteDate!, 1))
                      }
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
                  {templates.length > 0 && (
                    <span className="relative ml-2">
                      <IconButton
                        aria-label="Insert template"
                        title="Insert template"
                        onClick={() => setTemplateMenuOpen((o) => !o)}
                      >
                        <FileTextIcon />
                      </IconButton>
                      {templateMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setTemplateMenuOpen(false)}
                          />
                          <div className="absolute top-full right-0 z-20 mt-1.5 w-52 rounded-xl border-(length:--border-w) border-line bg-surface p-1.5 shadow-lg">
                            {templates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => applyTemplate(t.id)}
                                className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </span>
                  )}
                  <IconButton
                    aria-label={
                      selected.reviewDue
                        ? "Remove from review queue"
                        : "Add to review queue"
                    }
                    title={
                      selected.reviewDue
                        ? "Remove from review queue"
                        : "Add to review queue"
                    }
                    onClick={toggleReviewQueue}
                    className={`${templates.length > 0 ? "" : "ml-2"} ${selected.reviewDue ? "text-accent-ink" : ""}`}
                  >
                    <RepeatIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Version history"
                    title="Version history"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <HistoryIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Attach a photo or audio file"
                    title="Attach a photo or audio file"
                    onClick={addAttachment}
                  >
                    <PaperclipIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Delete note"
                    title="Delete note"
                    onClick={() => setConfirmingDelete(true)}
                    className="hover:text-danger"
                  >
                    <TrashIcon />
                  </IconButton>
                </span>
              </div>

              <input
                ref={titleInputRef}
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                onKeyDown={(e) => moveToEditorOnKey(e, e.currentTarget.parentElement)}
                className="font-display mb-5 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-faint"
                placeholder={COPY.titlePlaceholder}
              />

              <NoteEditor
                key={`${selected.id}:${editorNonce}`}
                initialValue={selected.content}
                onChange={updateContent}
                onNavigateLink={navigateToTitle}
                onTagClick={toggleTag}
                noteTitles={notes
                  .filter((n) => n.id !== selected.id)
                  .map((n) => n.title)}
                tagNames={tags.map((t) => t.name)}
                onExitUp={() => titleInputRef.current?.focus()}
              />

              {attachmentError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {attachmentError}
                </p>
              )}
              <Attachments
                attachments={selected.attachments}
                onRemove={removeAttachment}
              />
            </div>
          ) : (
            <EmptyState onCreate={() => createNote()} />
          )}
        </div>

        {selected && (
          <aside className="w-72 flex-none overflow-y-auto border-l-(length:--border-w) border-line bg-surface px-5 py-6">
            <SectionHeading
              icon={
                selected.type === "structure" ? <LayersIcon /> : <NetworkIcon />
              }
            >
              {selected.type === "structure" ? "Contents" : "Links"} (
              {selected.contents.length})
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
                  <NoteLink
                    zettelId={b.zettelId}
                    title={b.title}
                    onClick={() => openNote(b.noteId)}
                  />
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
          onSearch={(query) => vaultClient.search(query)}
          onSelect={(id) => {
            setSwitcherOpen(false);
            openNote(id);
          }}
          onCreate={(title) => {
            setSwitcherOpen(false);
            createNote(title);
          }}
          onClose={() => setSwitcherOpen(false)}
          commands={commands}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          vault={{
            path: vaultPath,
            onChoose: chooseFolder,
            onShow: showVault,
            getSummary: vaultSummary,
            onPurge: purgeVault,
          }}
        />
      )}

      {templatesOpen && (
        <TemplatesModal
          templates={templates}
          onClose={() => setTemplatesOpen(false)}
          onCreate={createTemplate}
          onUpdate={updateTemplateEntry}
          onDelete={deleteTemplateEntry}
          onSetDefaultForDailyNote={setDefaultTemplate}
        />
      )}

      {historyOpen && selected && (
        <VersionHistoryModal
          noteId={selected.id}
          currentContent={selected.content}
          onClose={() => setHistoryOpen(false)}
          onListVersions={(noteId) => vaultClient.listNoteVersions(noteId)}
          onGetVersion={(noteId, versionId) => vaultClient.getNoteVersion(noteId, versionId)}
          onRestore={async (noteId, versionId) => {
            await flushPending();
            const restored = await vaultClient.restoreNoteVersion(noteId, versionId);
            setSelected(
              await loadNote(restored.id),
            );
            setEditorNonce((n) => n + 1);
            refreshNotes(activeTag);
          }}
        />
      )}

      {namingCanvas && (
        <PromptDialog
          title="New canvas"
          defaultValue="Untitled canvas"
          confirmLabel="Create"
          onSubmit={createCanvas}
          onCancel={() => setNamingCanvas(false)}
        />
      )}

      {confirmingDelete && selected && (
        <ConfirmDialog
          title={COPY.deleteNoteTitle}
          body={COPY.deleteNoteBody(selected.title)}
          confirmLabel="Delete"
          onConfirm={deleteSelected}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {reviewQueue && (
        <ReviewSession
          note={reviewNote}
          current={Math.min(reviewIndex + 1, reviewQueue.length)}
          total={reviewQueue.length}
          onRate={rateReviewNote}
          onClose={closeReview}
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

      {flowData && (
        <FlowView
          nodes={flowData.nodes}
          edges={flowData.edges}
          storageKey={vaultPath}
          onSelectNode={(id) => {
            setFlowData(null);
            openNote(id);
          }}
          onClose={() => setFlowData(null)}
          onLoadNote={async (id) => {
            const note = await loadNote(id);
            return {
              title: note.title,
              content: note.content,
              tags: note.tagNames,
            };
          }}
          onSaveNote={saveNoteFromFlow}
          onCreateNote={createNoteFromFlow}
          onDeleteNote={deleteNoteFromFlow}
        />
      )}

      {openCanvasId && (
        <CanvasView
          canvasId={openCanvasId}
          notes={notes}
          onClose={() => {
            setOpenCanvasId(null);
            refreshCanvases();
          }}
          onOpenNote={(id) => {
            setOpenCanvasId(null);
            openNote(id);
          }}
          onLoad={(id) => vaultClient.getCanvas(id)}
          onSave={async (input) => {
            await vaultClient.updateCanvas(input);
          }}
          onSearchNotes={(query) => vaultClient.search(query)}
          onCreateNote={createNoteForCanvas}
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
