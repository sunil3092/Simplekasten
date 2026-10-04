"use client";

import { COPY, createPendingSaver } from "@simplekasten/core";
import { useEffect, useRef, useState } from "react";
import { NOTE_TYPES, type NoteType } from "../lib/noteTypes";
import { CheckIcon, XIcon } from "./icons";
import { moveToEditorOnKey, NoteEditor } from "./NoteEditor";
import { Button, ConfirmDialog } from "./ui";

interface ReviewNote {
  id: string;
  zettelId: string;
  title: string;
  content: string;
}

interface ReviewSessionProps {
  note: ReviewNote | null;
  current: number;
  total: number;
  noteTitles: string[];
  tagNames: string[];
  onSave: (input: { id: string; title: string; content: string }) => Promise<void>;
  onSetType: (id: string, type: NoteType) => Promise<void>;
  onSkip: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const SAVE_DEBOUNCE_MS = 600;
// How long the buttons stay off after an action. The vault answers faster
// than a double click's second press, which would otherwise land on the note
// that just appeared.
const SETTLE_MS = 350;
// What a fleeting note can become. Not "daily": a journal entry belongs to a
// date and is made from Today. Not "fleeting": that is what Skip means.
const SORT_TYPES = NOTE_TYPES.filter((t) => t.value !== "fleeting" && t.value !== "daily");

// Review is where fleeting notes get sorted: read one, rewrite it if it needs
// it, and say what it is. Full screen for the same reason GraphView is — this
// is the primary activity for as long as it's open.
export function ReviewSession({ note, current, total, noteTitles, tagNames, onSave, onSetType, onSkip, onDelete, onClose }: ReviewSessionProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note?.title ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  // One action at a time, and a moment's pause after each (see SETTLE_MS).
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (settleRef.current && clearTimeout(settleRef.current)), []);
  const textRef = useRef({ title: note?.title ?? "", content: note?.content ?? "" });
  // Saves for the note go one after another, and every action waits for them
  // — see createPendingSaver for what goes wrong otherwise.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const saver = useRef(createPendingSaver((pending: { id: string; title: string; content: string }) => onSaveRef.current(pending))).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmingRef = useRef(confirmingDelete);
  confirmingRef.current = confirmingDelete;

  // A new note arrived: the card shows its text, not the last one's.
  useEffect(() => {
    textRef.current = { title: note?.title ?? "", content: note?.content ?? "" };
    setTitle(note?.title ?? "");
    setFailed(false);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    await saver.flush();
  }

  function edit(next: Partial<{ title: string; content: string }>) {
    if (!note) return;
    textRef.current = { ...textRef.current, ...next };
    saver.set({ id: note.id, ...textRef.current });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush().catch(() => setFailed(true)), SAVE_DEBOUNCE_MS);
  }

  async function act(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await flush();
      await action();
    } catch {
      setFailed(true);
    } finally {
      settleRef.current = setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
      }, SETTLE_MS);
    }
  }

  async function close() {
    try {
      await flush();
    } catch {
      // The text is lost either way once the screen closes; closing is what was asked for.
    }
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape first dismisses whatever is open on top — the editor's
      // suggestion list (it marks that as handled) or the delete confirmation.
      if (e.defaultPrevented || confirmingRef.current) return;
      if (e.key === "Escape") void close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="review-session">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">{COPY.reviewTitle}</h2>
        <div className="flex items-center gap-3">
          {note && <span className="font-mono text-xs text-ink-faint">{COPY.reviewProgress(current, total)}</span>}
          <button
            onClick={() => void close()}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <XIcon />
            {COPY.reviewClose}
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-10 py-8">
        {note ? (
          <div className="w-full max-w-2xl">
            <div ref={cardRef} className="mb-4 flex h-[50vh] flex-col rounded-2xl border-(length:--border-w) border-line bg-surface p-8">
              <div className="mb-3 font-mono text-xs text-ink-faint">{note.zettelId}</div>
              <input
                aria-label="Title"
                value={title}
                // Typing while an action is on its way would be saved against a note that is leaving.
                readOnly={busy}
                onChange={(e) => {
                  setTitle(e.target.value);
                  edit({ title: e.target.value });
                }}
                onKeyDown={(e) => moveToEditorOnKey(e, cardRef.current)}
                placeholder={COPY.titlePlaceholder}
                className="font-display mb-4 w-full border-none bg-transparent text-2xl font-bold text-ink outline-none"
              />
              <div className="min-h-0 flex-1">
                {/* Uncontrolled: keyed by note so each note mounts its own editor. */}
                <NoteEditor
                  key={note.id}
                  compact
                  initialValue={note.content}
                  onChange={(content) => edit({ content })}
                  onNavigateLink={() => {}}
                  onTagClick={() => {}}
                  noteTitles={noteTitles}
                  tagNames={tagNames}
                  onExitUp={() => cardRef.current?.querySelector<HTMLInputElement>("input")?.focus()}
                />
              </div>
            </div>
            {failed && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {COPY.reviewActionFailed}
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {SORT_TYPES.map((t) => (
                <Button key={t.value} variant={t.value === "permanent" ? "primary" : "secondary"} disabled={busy} onClick={() => act(() => onSetType(note.id, t.value))}>
                  {t.label}
                </Button>
              ))}
              <Button variant="ghost" disabled={busy} onClick={() => act(onSkip)}>
                {COPY.reviewSkip}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                {COPY.reviewDelete}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-faint">
              <CheckIcon width={26} height={26} />
            </div>
            <p className="text-sm text-ink-muted">{COPY.reviewCaughtUp}</p>
            <Button onClick={() => void close()}>{COPY.reviewClose}</Button>
          </div>
        )}
      </div>

      {confirmingDelete && note && (
        <ConfirmDialog
          title={COPY.deleteNoteTitle}
          body={COPY.deleteNoteBody(textRef.current.title)}
          confirmLabel={COPY.reviewDelete}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            // The note is going; an edit waiting to be saved must not land after it.
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
            saver.clear();
            void act(() => onDelete(note.id));
          }}
        />
      )}
    </div>
  );
}
