"use client";

import { layoutFlow, routeFlowEdge, type FlowPoint, type FlowRect } from "@simplekasten/local-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { noteTypeInfo } from "../lib/noteTypes";
import { ExpandIcon, LayoutIcon, XIcon } from "./icons";

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
  onLoadNote: (id: string) => Promise<{ title: string; content: string }>;
  onSaveNote: (input: { id: string; title?: string; content?: string }) => Promise<void>;
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

export function FlowView({ nodes, edges, onSelectNode, onClose, onLoadNote, onSaveNote, storageKey = "" }: FlowViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 60, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const { colors } = useTheme().resolved;
  const typeColor = (type: string) => colors[noteTypeInfo(type).graphColor];

  const [cardText, setCardText] = useState<Map<string, { title: string; content: string }>>(new Map());
  const saveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingSavesRef = useRef(new Map<string, { title: string; content: string }>());

  function flushSave(id: string) {
    const timer = saveTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimersRef.current.delete(id);
    const pending = pendingSavesRef.current.get(id);
    pendingSavesRef.current.delete(id);
    if (pending) onSaveNote({ id, ...pending });
  }

  function flushAllSaves() {
    for (const id of Array.from(pendingSavesRef.current.keys())) flushSave(id);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      nodes.map(async (n) => {
        try {
          const detail = await onLoadNote(n.id);
          return [n.id, detail] as const;
        } catch {
          return [n.id, { title: n.title, content: "" }] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setCardText(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  useEffect(() => {
    return () => flushAllSaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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

  const layout = useMemo(() => layoutFlow(nodes, edges), [nodes, edges]);
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

  const presentTypes = useMemo(() => Array.from(new Set(nodes.map((n) => n.type))), [nodes]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="flow-view">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Flow view</h2>
        <div className="flex items-center gap-2">
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

                return (
                  <div
                    key={l.id}
                    data-testid="flow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredId(l.id)}
                    onMouseLeave={() => setHoveredId((current) => (current === l.id ? null : current))}
                    className="absolute flex flex-col overflow-hidden rounded-lg border-2 bg-surface shadow-lg"
                    style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, height: CARD_HEIGHT, borderColor: typeColor(node.type) }}
                  >
                    <div
                      data-testid="flow-card-handle"
                      title="Drag to move"
                      onMouseDown={(e) => onCardHeaderMouseDown(e, l.id)}
                      className="flex cursor-grab items-center justify-between border-b-(length:--border-w) border-line-soft bg-surface-2 px-2 py-1 select-none active:cursor-grabbing"
                    >
                      <span className="font-mono text-[10px] text-ink-faint">{node.zettelId}</span>
                      <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openInEditor(l.id)}
                          aria-label="Open in editor"
                          title="Open in editor"
                          className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                        >
                          <ExpandIcon width={12} height={12} />
                        </button>
                        <button
                          onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
                          aria-label="Done editing"
                          title="Done editing"
                          className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                        >
                          <XIcon width={12} height={12} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={text.title}
                      onChange={(e) => onTitleChange(l.id, e.target.value)}
                      placeholder="Untitled"
                      className="font-display w-full border-none bg-transparent px-3 pt-2 text-base font-bold text-ink outline-none"
                    />
                    <textarea
                      value={text.content}
                      onChange={(e) => onContentChange(l.id, e.target.value)}
                      placeholder="Start writing…"
                      className="min-h-0 flex-1 resize-none border-none bg-transparent px-3 pt-1 pb-2 text-xs leading-relaxed text-ink outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </>
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
