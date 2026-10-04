"use client";

import { JOURNAL_TAG } from "@simplekasten/core";
import { layoutFlow, routeFlowEdge, type FlowPoint, type FlowRect } from "@simplekasten/local-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { NOTE_TYPES, noteTypeInfo } from "../lib/noteTypes";
import { CalendarIcon, ChevronDownIcon, ExpandIcon, LayoutIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from "./icons";
import { moveToEditorOnKey, NoteEditor } from "./NoteEditor";
import { ConfirmDialog } from "./ui";

export interface FlowNode {
  id: string;
  title: string;
  zettelId: string;
  type: string;
}

export interface FlowEdge {
  source: string;
  target: string;
}

interface FlowViewProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onSelectNode: (id: string) => void;
  onClose: () => void;
  onLoadNote: (id: string) => Promise<{ title: string; content: string; tags?: string[] }>;
  /** Resolves with the note's tags as saved, so the tag filter stays current. */
  onSaveNote: (input: { id: string; title?: string; content?: string; type?: string }) => Promise<{ tags?: string[] } | void>;
  onCreateNote: () => Promise<{ id: string }>;
  onDeleteNote: (id: string) => Promise<void>;
  /** Identifies the vault, so each vault remembers its own card arrangement. */
  storageKey?: string;
}

// Gaps between cards (80 across, 100 down) are wide enough for an arrow to
// pass between two neighbours with clearance on both sides.
const LAYER_HEIGHT = 270;
const COLUMN_WIDTH = 340;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 170;
const EDGE_CORNER_RADIUS = 18;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const SAVE_DEBOUNCE_MS = 600;

type Positions = Map<string, FlowPoint>;

const positionsKey = (storageKey: string) => `simplekasten.flow-positions:${storageKey}`;

// Card positions the user dragged to. Kept in localStorage: it is view state
// for this device, not vault content. Storage can be unavailable or hold
// junk, so reads fall back to "nothing moved".
function loadPositions(storageKey: string): Positions {
  const map: Positions = new Map();
  try {
    const raw = JSON.parse(window.localStorage.getItem(positionsKey(storageKey)) ?? "{}") as Record<string, FlowPoint>;
    for (const [id, p] of Object.entries(raw)) {
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) map.set(id, { x: p.x, y: p.y });
    }
  } catch {
    // fall through with whatever was readable
  }
  return map;
}

function savePositions(storageKey: string, positions: Positions) {
  try {
    if (positions.size === 0) window.localStorage.removeItem(positionsKey(storageKey));
    else window.localStorage.setItem(positionsKey(storageKey), JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // the arrangement just won't be remembered
  }
}

const cardRect = (p: FlowPoint): FlowRect => ({ x: p.x, y: p.y, width: CARD_WIDTH, height: CARD_HEIGHT });

function overlaps(a: FlowPoint, b: FlowPoint): boolean {
  return Math.abs(a.x - b.x) < CARD_WIDTH && Math.abs(a.y - b.y) < CARD_HEIGHT;
}

/** SVG path through the points, with the bends rounded off. */
function roundedPath(points: FlowPoint[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(EDGE_CORNER_RADIUS, inLength / 2, outLength / 2);
    if (r === 0) continue;
    const before = { x: corner.x - ((corner.x - prev.x) / inLength) * r, y: corner.y - ((corner.y - prev.y) / inLength) * r };
    const after = { x: corner.x + ((next.x - corner.x) / outLength) * r, y: corner.y + ((next.y - corner.y) / outLength) * r };
    d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

// Filter value for notes carrying no tag at all. Not a valid tag name, so it
// can never collide with a real one.
const UNTAGGED = "\u0000untagged";

interface TagOption {
  value: string;
  label: string;
  count: number;
}

/** Tag search box: pick any number of tags; suggestions fill in as you type. */
function TagFilter({ options, selected, onChange }: { options: TagOption[]; selected: string[]; onChange: (next: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const needle = query.trim().replace(/^#/, "").toLowerCase();
  const suggestions = options.filter((o) => !selected.includes(o.value) && o.label.toLowerCase().includes(needle));
  const active = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));

  function add(value: string) {
    onChange([...selected, value]);
    setQuery("");
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      // Escape closes the suggestions, not the whole flow view.
      e.stopPropagation();
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(Math.min(active + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      if (suggestions[active]) add(suggestions[active].value);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-lg border-(length:--border-w) border-line bg-surface px-2.5 py-1 focus-within:border-accent"
      >
        <SearchIcon className="flex-none text-ink-faint" />
        {selected.map((value) => (
          <span
            key={value}
            data-testid="flow-filter-chip"
            className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2 font-mono text-xs text-accent-ink"
          >
            {labelOf(value)}
            <button
              onClick={() => onChange(selected.filter((v) => v !== value))}
              aria-label={`Remove ${labelOf(value)}`}
              className="rounded-full p-0.5 hover:bg-surface"
            >
              <XIcon width={10} height={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-label="Filter by tag"
          aria-expanded={open}
          aria-controls="flow-filter-options"
          placeholder={selected.length === 0 ? "Filter by tag…" : "Add another tag…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-w-24 flex-1 border-none bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="flex-none text-xs text-ink-faint transition-colors hover:text-ink-muted">
            Clear
          </button>
        )}
      </div>
      {open && (
        <ul
          id="flow-filter-options"
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border-(length:--border-w) border-line bg-surface p-1.5 shadow-lg"
        >
          {suggestions.map((o, i) => (
            <li key={o.value} role="option" aria-selected={i === active}>
              <button
                // Keeps focus in the input, so picking a tag doesn't close the list.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o.value)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs ${
                  i === active ? "bg-accent-soft text-accent-ink" : "text-ink"
                }`}
              >
                {o.label}
                <span className="text-ink-faint">{o.count}</span>
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="px-2.5 py-1.5 text-xs text-ink-faint">{options.length === selected.length ? "Every tag is selected." : "No matching tag."}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function FlowView({ nodes, edges, onSelectNode, onClose, onLoadNote, onSaveNote, onCreateNote, onDeleteNote, storageKey = "" }: FlowViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 60, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const { colors } = useTheme().resolved;
  const typeColor = (type: string) => colors[noteTypeInfo(type).graphColor];

  const [cardText, setCardText] = useState<Map<string, { title: string; content: string }>>(new Map());
  // Each note's tags as last loaded or saved.
  const [noteTags, setNoteTags] = useState<Map<string, string[]>>(new Map());
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [hideJournal, setHideJournal] = useState(false);
  // A type just picked on a card, shown at once while the save and the
  // refreshed `nodes` catch up.
  const [pickedTypes, setPickedTypes] = useState<Map<string, string>>(new Map());
  // The card being typed in stays on screen even if its tags stop matching
  // the filter — otherwise retyping a #hashtag would whisk it away mid-edit.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(deletingId);
  deletingRef.current = deletingId;
  const mountedRef = useRef(true);
  const loadedIdsRef = useRef(new Set<string>());
  const saveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingSavesRef = useRef(new Map<string, { title: string; content: string }>());

  function flushSave(id: string) {
    const timer = saveTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimersRef.current.delete(id);
    const pending = pendingSavesRef.current.get(id);
    pendingSavesRef.current.delete(id);
    if (!pending) return;
    onSaveNote({ id, ...pending })
      .then((saved) => applySavedTags(id, saved))
      .catch(() => {
        // The text stays in the card; the next edit retries the save.
      });
  }

  function applySavedTags(id: string, saved: { tags?: string[] } | void) {
    const tags = saved?.tags;
    if (tags && mountedRef.current) setNoteTags((prev) => new Map(prev).set(id, tags));
  }

  function changeType(id: string, type: string) {
    // Text still waiting to be saved goes first, so the two writes can't cross.
    flushSave(id);
    setPickedTypes((prev) => new Map(prev).set(id, type));
    onSaveNote({ id, type })
      // The type decides the journal tag, so tags come back with it.
      .then((saved) => applySavedTags(id, saved))
      .catch(() => {
        // Fall back to the type the vault still has.
        if (mountedRef.current) {
          setPickedTypes((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }
      });
  }

  // Once `nodes` reports the picked type, the override has done its job.
  useEffect(() => {
    setPickedTypes((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const n of nodes) if (next.get(n.id) === n.type) next.delete(n.id);
      return next.size === prev.size ? prev : next;
    });
  }, [nodes]);

  function flushAllSaves() {
    for (const id of Array.from(pendingSavesRef.current.keys())) flushSave(id);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // `nodes` is replaced after every save, create and delete. Only notes not
  // seen before are fetched: reloading a card that is being typed in would
  // overwrite the text under the cursor.
  useEffect(() => {
    const fresh = nodes.filter((n) => !loadedIdsRef.current.has(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) loadedIdsRef.current.add(n.id);
    Promise.all(
      fresh.map(async (n) => {
        try {
          const detail = await onLoadNote(n.id);
          return [n.id, detail] as const;
        } catch {
          return [n.id, { title: n.title, content: "", tags: [] as string[] }] as const;
        }
      }),
    ).then((entries) => {
      if (!mountedRef.current) return;
      setCardText((prev) => {
        const next = new Map(prev);
        for (const [id, d] of entries) if (!next.has(id)) next.set(id, { title: d.title, content: d.content });
        return next;
      });
      setNoteTags((prev) => {
        const next = new Map(prev);
        for (const [id, d] of entries) if (!next.has(id)) next.set(id, d.tags ?? []);
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  useEffect(() => {
    return () => flushAllSaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape first dismisses whatever is open on top — a card's suggestion
      // list (the editor marks that as handled) or the delete confirmation.
      if (e.defaultPrevented || deletingRef.current) return;
      if (e.key === "Escape") {
        flushAllSaves();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  function scheduleSave(id: string, next: { title: string; content: string }) {
    pendingSavesRef.current.set(id, next);
    const existing = saveTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    saveTimersRef.current.set(
      id,
      setTimeout(() => flushSave(id), SAVE_DEBOUNCE_MS),
    );
  }

  function onTitleChange(id: string, value: string) {
    setCardText((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? { title: "", content: "" };
      next.set(id, { ...current, title: value });
      scheduleSave(id, { ...current, title: value });
      return next;
    });
  }

  function onContentChange(id: string, value: string) {
    setCardText((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? { title: "", content: "" };
      next.set(id, { ...current, content: value });
      scheduleSave(id, { ...current, content: value });
      return next;
    });
  }

  function openInEditor(id: string) {
    flushSave(id);
    onSelectNode(id);
  }

  async function createCard() {
    const { id } = await onCreateNote();
    // Pinned as "being edited" so it shows even under a tag filter it doesn't match.
    setEditingId(id);
    setFocusId(id);
  }

  async function deleteCard(id: string) {
    setDeletingId(null);
    // An edit still waiting to be saved must not land after the delete.
    const timer = saveTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimersRef.current.delete(id);
    pendingSavesRef.current.delete(id);
    await onDeleteNote(id);
    if (!mountedRef.current) return;
    setCardText((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setNoteTags((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (movedRef.current.has(id)) {
      const next = new Map(movedRef.current);
      next.delete(id);
      setMoved(next);
      savePositions(storageKey, next);
    }
  }

  // Ctrl/Cmd+click on a [[link]] in a card opens that note, like the main editor.
  function followLink(title: string) {
    const wanted = title.toLowerCase();
    const target = nodes.find((n) => (cardText.get(n.id)?.title ?? n.title).toLowerCase() === wanted);
    if (target) openInEditor(target.id);
  }

  // Put the cursor in a newly created card's title once the card is on screen.
  useEffect(() => {
    if (!focusId) return;
    const input = containerRef.current?.querySelector<HTMLInputElement>(`[data-flow-card-id="${focusId}"] input`);
    if (!input) return;
    input.focus();
    input.select();
    setFocusId(null);
  });

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const tags of noteTags.values()) {
      if (tags.length === 0) untagged++;
      for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const options: TagOption[] = Array.from(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, count]) => ({ value: tag, label: `#${tag}`, count }));
    if (untagged > 0) options.push({ value: UNTAGGED, label: "Untagged", count: untagged });
    return options;
  }, [noteTags]);

  // A note shows when it carries any of the chosen tags; arrows are kept
  // only between notes that are both showing, so each tag reads as its own
  // set of branches.
  const journalCount = useMemo(() => nodes.filter((n) => n.type === "daily").length, [nodes]);

  const visibleNodes = useMemo(() => {
    if (filterTags.length === 0 && !hideJournal) return nodes;
    return nodes.filter((n) => {
      if (n.id === editingId) return true;
      if (hideJournal && n.type === "daily") return false;
      if (filterTags.length === 0) return true;
      const tags = noteTags.get(n.id) ?? [];
      return tags.length === 0 ? filterTags.includes(UNTAGGED) : tags.some((t) => filterTags.includes(t));
    });
  }, [nodes, noteTags, filterTags, hideJournal, editingId]);

  // Asking for the journal tag by name overrides "hide journal" — otherwise
  // the filter would promise journal entries and show none.
  function changeFilter(next: string[]) {
    if (next.includes(JOURNAL_TAG)) setHideJournal(false);
    setFilterTags(next);
  }

  const allTagNames = useMemo(() => tagOptions.filter((o) => o.value !== UNTAGGED).map((o) => o.value), [tagOptions]);

  const layout = useMemo(() => layoutFlow(visibleNodes, edges), [visibleNodes, edges]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const autoPositions = useMemo(() => {
    const layerCounts = new Map<number, number>();
    for (const l of layout) layerCounts.set(l.layer, (layerCounts.get(l.layer) ?? 0) + 1);
    const map: Positions = new Map();
    for (const l of layout) {
      const count = layerCounts.get(l.layer) ?? 1;
      map.set(l.id, {
        x: l.order * COLUMN_WIDTH - ((count - 1) * COLUMN_WIDTH) / 2,
        y: l.layer * LAYER_HEIGHT,
      });
    }
    return map;
  }, [layout]);

  // Cards the user has dragged keep their spot; everything else follows the
  // automatic layout.
  const [moved, setMoved] = useState<Positions>(() => loadPositions(storageKey));
  const movedRef = useRef(moved);
  movedRef.current = moved;

  const positions = useMemo(() => {
    const map: Positions = new Map();
    const placed: FlowPoint[] = [];
    for (const [id] of autoPositions) {
      const spot = moved.get(id);
      if (spot) {
        map.set(id, spot);
        placed.push(spot);
      }
    }
    // An automatic slot may now be under a card the user parked there — step
    // sideways until it is free rather than stacking two cards.
    for (const [id, auto] of autoPositions) {
      if (map.has(id)) continue;
      let spot = auto;
      for (let tries = 0; tries < 50 && placed.some((p) => overlaps(p, spot)); tries++) {
        spot = { x: spot.x + COLUMN_WIDTH, y: spot.y };
      }
      map.set(id, spot);
      placed.push(spot);
    }
    return map;
  }, [autoPositions, moved]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const routes = useMemo(() => {
    const rects = new Map(Array.from(positions, ([id, p]) => [id, cardRect(p)] as const));
    return edges.flatMap((e) => {
      const from = rects.get(e.source);
      const to = rects.get(e.target);
      if (!from || !to || e.source === e.target) return [];
      const others = Array.from(rects)
        .filter(([id]) => id !== e.source && id !== e.target)
        .map(([, rect]) => rect);
      return [{ source: e.source, target: e.target, d: roundedPath(routeFlowEdge(from, to, others)) }];
    });
  }, [edges, positions]);

  function autoArrange() {
    setMoved(new Map());
    savePositions(storageKey, new Map());
  }

  useEffect(() => {
    if (positions.size === 0 || !containerRef.current) return;
    const xs = Array.from(positions.values()).map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + CARD_WIDTH;
    const width = containerRef.current.clientWidth;
    setView((v) => ({ ...v, x: width / 2 - (minX + maxX) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.length]);

  const panRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; cardX: number; cardY: number } | null>(null);

  function onCardHeaderMouseDown(e: React.MouseEvent, id: string) {
    const pos = positions.get(id);
    if (!pos || e.button !== 0) return;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, cardX: pos.x, cardY: pos.y };
  }

  function onBackgroundMouseDown(e: React.MouseEvent) {
    panRef.current = { startX: e.clientX, startY: e.clientY, viewX: viewRef.current.x, viewY: viewRef.current.y };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (drag) {
        const scale = viewRef.current.scale;
        const spot = { x: drag.cardX + (e.clientX - drag.startX) / scale, y: drag.cardY + (e.clientY - drag.startY) / scale };
        setMoved((prev) => new Map(prev).set(drag.id, spot));
        return;
      }
      const pan = panRef.current;
      if (!pan) return;
      setView((v) => ({ ...v, x: pan.viewX + (e.clientX - pan.startX), y: pan.viewY + (e.clientY - pan.startY) }));
    }
    function onMouseUp() {
      if (dragRef.current) savePositions(storageKey, movedRef.current);
      dragRef.current = null;
      panRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [storageKey]);

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

  const presentTypes = useMemo(() => Array.from(new Set(visibleNodes.map((n) => n.type))), [visibleNodes]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="flow-view">
      <div className="flex items-center justify-between gap-4 border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display flex-none text-lg font-bold text-ink">Flow view</h2>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <TagFilter options={tagOptions} selected={filterTags} onChange={changeFilter} />
          {journalCount > 0 && (
            <button
              onClick={() => {
                if (!hideJournal) setFilterTags((current) => current.filter((t) => t !== JOURNAL_TAG));
                setHideJournal(!hideJournal);
              }}
              aria-pressed={!hideJournal}
              title={hideJournal ? "Journal entries are hidden — click to show them" : "This flow includes journal entries — click to hide them"}
              data-testid="flow-journal-toggle"
              className={`flex flex-none items-center gap-1.5 rounded-full border-(length:--border-w) px-2.5 py-1 font-mono text-xs transition-colors ${
                hideJournal ? "border-line text-ink-faint line-through hover:text-ink-muted" : "border-accent bg-accent-soft text-accent-ink"
              }`}
            >
              <CalendarIcon width={12} height={12} />
              Journal {journalCount}
            </button>
          )}
          {(filterTags.length > 0 || hideJournal) && (
            <span data-testid="flow-filter-count" className="flex-none font-mono text-xs text-ink-faint">
              {visibleNodes.length} of {nodes.length}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            onClick={createCard}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <PlusIcon />
            New note
          </button>
          <button
            onClick={autoArrange}
            disabled={moved.size === 0}
            title="Put every card back in its automatic position"
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink disabled:cursor-default disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-muted"
          >
            <LayoutIcon />
            Auto-arrange
          </button>
          <button
            onClick={() => {
              flushAllSaves();
              onClose();
            }}
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
        data-testid="flow-surface"
      >
        {nodes.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-ink-faint">No notes yet.</p>
        ) : (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={colors.inkFaint} />
                </marker>
                <marker id="flow-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={colors.accent} />
                </marker>
              </defs>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {routes.map((route, i) => {
                  // Hovering a card picks out its own arrows from the rest.
                  const active = hoveredId !== null && (route.source === hoveredId || route.target === hoveredId);
                  return (
                    <path
                      key={i}
                      data-testid="flow-edge"
                      d={route.d}
                      stroke={active ? colors.accent : colors.inkFaint}
                      strokeWidth={active ? 2.5 : 1.5}
                      fill="none"
                      markerEnd={active ? "url(#flow-arrow-active)" : "url(#flow-arrow)"}
                    />
                  );
                })}
              </g>
            </svg>

            <div className="absolute top-0 left-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}>
              {layout.map((l) => {
                const node = nodesById.get(l.id);
                const pos = positions.get(l.id);
                if (!node || !pos) return null;
                const text = cardText.get(l.id) ?? { title: node.title, content: "" };
                const type = pickedTypes.get(l.id) ?? node.type;

                return (
                  <div
                    key={l.id}
                    data-testid="flow-card"
                    data-flow-card-id={l.id}
                    onFocus={() => setEditingId(l.id)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setEditingId((current) => (current === l.id ? null : current));
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredId(l.id)}
                    onMouseLeave={() => setHoveredId((current) => (current === l.id ? null : current))}
                    // cursor-default: the canvas's grab cursor would otherwise show over the whole card.
                    className="absolute flex cursor-default flex-col overflow-hidden rounded-lg border-2 bg-surface shadow-lg"
                    style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, height: CARD_HEIGHT, borderColor: typeColor(type) }}
                  >
                    <div
                      data-testid="flow-card-handle"
                      title="Drag to move"
                      onMouseDown={(e) => onCardHeaderMouseDown(e, l.id)}
                      className="flex cursor-grab items-center justify-between border-b-(length:--border-w) border-line-soft bg-surface-2 px-2 py-1 select-none active:cursor-grabbing"
                    >
                      <span className="flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                        {node.zettelId}
                        {type === "daily" && (
                          <span data-testid="flow-journal-badge" className="flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-px text-accent-ink">
                            <CalendarIcon width={10} height={10} />
                            Journal
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
                        <label className="relative mr-1 flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink">
                          <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: typeColor(type) }} />
                          <select
                            aria-label="Note type"
                            title="Note type"
                            value={type}
                            onChange={(e) => changeType(l.id, e.target.value)}
                            className="cursor-pointer appearance-none bg-transparent pr-3 font-mono text-[10px] font-medium tracking-wide uppercase outline-none"
                          >
                            {NOTE_TYPES.map((t) => (
                              // Option lists are drawn by the OS, outside the theme, so they need their own colours.
                              <option key={t.value} value={t.value} className="bg-surface text-ink">
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDownIcon width={10} height={10} className="pointer-events-none absolute right-1 opacity-60" />
                        </label>
                        <button
                          onClick={() => openInEditor(l.id)}
                          aria-label="Open in editor"
                          title="Open in editor"
                          className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                        >
                          <ExpandIcon width={12} height={12} />
                        </button>
                        <button
                          onClick={() => setDeletingId(l.id)}
                          aria-label="Delete note"
                          title="Delete note"
                          className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-danger"
                        >
                          <TrashIcon width={12} height={12} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={text.title}
                      onChange={(e) => onTitleChange(l.id, e.target.value)}
                      onKeyDown={(e) => moveToEditorOnKey(e, e.currentTarget.parentElement)}
                      placeholder="Untitled"
                      className="font-display w-full border-none bg-transparent px-3 pt-2 text-base font-bold text-ink outline-none"
                    />
                    <div className="min-h-0 flex-1 px-3 pt-1 pb-2" data-testid="flow-card-body">
                      {/* The editor owns its text once mounted, so it waits for the note to load. */}
                      {cardText.has(l.id) && (
                        <NoteEditor
                          compact
                          initialValue={text.content}
                          onChange={(value) => onContentChange(l.id, value)}
                          onNavigateLink={followLink}
                          onTagClick={(tag) => changeFilter(filterTags.includes(tag) ? filterTags : [...filterTags, tag])}
                          noteTitles={nodes.filter((n) => n.id !== l.id).map((n) => cardText.get(n.id)?.title ?? n.title)}
                          tagNames={allTagNames}
                          onExitUp={() => containerRef.current?.querySelector<HTMLInputElement>(`[data-flow-card-id="${l.id}"] input`)?.focus()}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {deletingId && (
          <ConfirmDialog
            title="Delete this note?"
            body={`"${cardText.get(deletingId)?.title || "Untitled"}" will be deleted. Links to it from other notes will stop resolving.`}
            confirmLabel="Delete"
            onConfirm={() => deleteCard(deletingId)}
            onCancel={() => setDeletingId(null)}
          />
        )}

        {presentTypes.length > 0 && (
          <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-xl border-(length:--border-w) border-line bg-surface px-3 py-2.5 text-xs text-ink-muted shadow-sm">
            {presentTypes.map((type) => (
              <span key={type} className="flex items-center gap-2">
                <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: typeColor(type) }} />
                {noteTypeInfo(type).label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
