"use client";

import type { CanvasCard, NoteListItem } from "@simplekasten/local-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, PlusIcon, XIcon } from "./icons";
import { QuickSwitcher } from "./QuickSwitcher";
import { Button } from "./ui";

interface SearchResultItem {
  id: string;
  title: string;
  zettelId: string;
  snippet: string;
}

interface CanvasViewProps {
  canvasId: string;
  notes: NoteListItem[];
  onClose: () => void;
  onOpenNote: (id: string) => void;
  onLoad: (id: string) => Promise<{ title: string; cards: CanvasCard[] }>;
  onSave: (input: { id: string; cards: CanvasCard[] }) => Promise<void>;
  onSearchNotes: (query: string) => Promise<SearchResultItem[]>;
  onCreateNote: (title: string) => Promise<{ id: string }>;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const DEFAULT_CARD = { width: 220, height: 140 };
const HEADER_HEIGHT = 26;

function generateCardId(): string {
  return `card${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// A corkboard, not a diagramming tool — freely positioned/resizable cards,
// no connecting lines in v1 (see canvas.md's "Scope decision"). Pan/zoom is
// hand-rolled with plain mouse events, same reasoning mobile's graph.tsx
// hand-rolls its own touch pan/zoom rather than pulling in a library.
export function CanvasView({ canvasId, notes, onClose, onOpenNote, onLoad, onSave, onSearchNotes, onCreateNote }: CanvasViewProps) {
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CanvasCard[] | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    onLoad(canvasId).then((data) => {
      setTitle(data.title);
      setCards(data.cards);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function persist(nextCards: CanvasCard[]) {
    await onSave({ id: canvasId, cards: nextCards });
  }

  function screenToCanvas(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }

  // ---- Pan -----------------------------------------------------------------
  const panRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);

  function onBackgroundMouseDown(e: React.MouseEvent) {
    panRef.current = { startX: e.clientX, startY: e.clientY, viewX: viewRef.current.x, viewY: viewRef.current.y };
  }

  // ---- Card drag / resize ---------------------------------------------------
  const dragRef = useRef<{ cardId: string; mode: "move" | "resize"; startX: number; startY: number; card: CanvasCard } | null>(null);

  function startDrag(e: React.MouseEvent, card: CanvasCard, mode: "move" | "resize") {
    e.stopPropagation();
    dragRef.current = { cardId: card.id, mode, startX: e.clientX, startY: e.clientY, card };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const pan = panRef.current;
      if (pan) {
        setView((v) => ({ ...v, x: pan.viewX + (e.clientX - pan.startX), y: pan.viewY + (e.clientY - pan.startY) }));
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const scale = viewRef.current.scale;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      setCards((current) =>
        (current ?? []).map((c) => {
          if (c.id !== drag.cardId) return c;
          if (drag.mode === "move") return { ...c, x: drag.card.x + dx, y: drag.card.y + dy };
          return { ...c, width: Math.max(140, drag.card.width + dx), height: Math.max(90, drag.card.height + dy) };
        }),
      );
    }
    function onMouseUp() {
      panRef.current = null;
      if (dragRef.current && cardsRef.current) persist(cardsRef.current);
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    setView((v) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * (1 - e.deltaY * 0.001)));
      const k = nextScale / v.scale;
      return { scale: nextScale, x: cursorX - (cursorX - v.x) * k, y: cursorY - (cursorY - v.y) * k };
    });
  }

  // ---- Adding / removing / editing cards -------------------------------------
  function viewportCenter() {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  async function addNoteCard(noteId: string) {
    if (!cards) return;
    const center = viewportCenter();
    const card: CanvasCard = { id: generateCardId(), kind: "note", noteId, x: center.x - DEFAULT_CARD.width / 2, y: center.y - DEFAULT_CARD.height / 2, ...DEFAULT_CARD };
    const next = [...cards, card];
    setCards(next);
    await persist(next);
  }

  function addTextCard() {
    if (!cards) return;
    const center = viewportCenter();
    const card: CanvasCard = { id: generateCardId(), kind: "text", text: "", x: center.x - DEFAULT_CARD.width / 2, y: center.y - DEFAULT_CARD.height / 2, ...DEFAULT_CARD };
    const next = [...cards, card];
    setCards(next);
    persist(next);
  }

  async function removeCard(cardId: string) {
    if (!cards) return;
    const next = cards.filter((c) => c.id !== cardId);
    setCards(next);
    await persist(next);
  }

  function setCardText(cardId: string, text: string) {
    setCards((current) => (current ?? []).map((c) => (c.id === cardId && c.kind === "text" ? { ...c, text } : c)));
  }

  async function commitCardText() {
    if (cards) await persist(cards);
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="canvas-view">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">{title || "Canvas"}</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            <PlusIcon />
            Note card
          </Button>
          <Button variant="secondary" size="sm" onClick={addTextCard}>
            <FileTextIcon />
            Text card
          </Button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <XIcon />
            Close
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={onBackgroundMouseDown}
        onWheel={onWheel}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-surface-2 active:cursor-grabbing"
        data-testid="canvas-surface"
      >
        <div className="absolute top-0 left-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}>
          {cards?.map((card) => {
            const note = card.kind === "note" ? notesById.get(card.noteId) : null;
            return (
              <div
                key={card.id}
                data-testid="canvas-card"
                className="absolute rounded-xl border-(length:--border-w) border-line bg-surface shadow-sm"
                style={{ left: card.x, top: card.y, width: card.width, height: card.height }}
              >
                <div
                  onMouseDown={(e) => startDrag(e, card, "move")}
                  className="flex h-[26px] cursor-move items-center justify-end rounded-t-xl bg-surface-2 px-1.5"
                  style={{ height: HEADER_HEIGHT }}
                >
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removeCard(card.id)}
                    aria-label="Remove card"
                    className="rounded p-0.5 text-ink-faint hover:text-danger"
                  >
                    <XIcon width={13} height={13} />
                  </button>
                </div>
                {card.kind === "note" ? (
                  <button
                    onClick={() => onOpenNote(card.noteId)}
                    className="flex h-[calc(100%-26px)] w-full flex-col items-start gap-1 overflow-hidden p-3 text-left"
                  >
                    <span className="font-mono text-[10px] text-ink-faint">{note?.zettelId ?? "?"}</span>
                    <span className="line-clamp-4 text-sm text-ink">{note?.title ?? "(note not found)"}</span>
                  </button>
                ) : (
                  <textarea
                    value={card.text}
                    onChange={(e) => setCardText(card.id, e.target.value)}
                    onBlur={commitCardText}
                    placeholder="Type a note…"
                    className="h-[calc(100%-26px)] w-full resize-none bg-transparent p-3 text-sm text-ink outline-none placeholder:text-ink-faint"
                  />
                )}
                <div
                  onMouseDown={(e) => startDrag(e, card, "resize")}
                  aria-hidden="true"
                  className="absolute right-0.5 bottom-0.5 h-3 w-3 cursor-nwse-resize rounded-sm border-r-2 border-b-2 border-ink-faint/50"
                />
              </div>
            );
          })}
        </div>
      </div>

      {pickerOpen && (
        <QuickSwitcher
          recentNotes={notes}
          onSearch={onSearchNotes}
          onSelect={(id) => {
            setPickerOpen(false);
            addNoteCard(id);
          }}
          onCreate={async (noteTitle) => {
            setPickerOpen(false);
            const created = await onCreateNote(noteTitle);
            addNoteCard(created.id);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
