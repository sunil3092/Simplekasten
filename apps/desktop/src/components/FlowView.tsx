"use client";

import { layoutFlow } from "@simplekasten/local-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { noteTypeInfo } from "../lib/noteTypes";
import { XIcon } from "./icons";

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
}

const LAYER_HEIGHT = 170;
const COLUMN_WIDTH = 220;
const CARD_WIDTH = 180;
const CARD_HEIGHT = 64;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;

// Prototype: the same nodes/edges Graph view already visualizes, read as a
// top-to-bottom "function block diagram" instead of a force-directed
// cluster — see packages/local-engine/src/flow-layout.ts for the layering
// algorithm. Pan/zoom is hand-rolled plain mouse events, same approach
// CanvasView already uses, since this needs real DOM cards (not SVG-only
// nodes like Graph view's force-graph library draws).
export function FlowView({ nodes, edges, onSelectNode, onClose }: FlowViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 60, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const { colors } = useTheme().resolved;
  const typeColor = (type: string) => colors[noteTypeInfo(type).graphColor];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const layout = useMemo(() => layoutFlow(nodes, edges), [nodes, edges]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const positions = useMemo(() => {
    const layerCounts = new Map<number, number>();
    for (const l of layout) layerCounts.set(l.layer, (layerCounts.get(l.layer) ?? 0) + 1);
    const map = new Map<string, { x: number; y: number }>();
    for (const l of layout) {
      const count = layerCounts.get(l.layer) ?? 1;
      map.set(l.id, {
        x: l.order * COLUMN_WIDTH - ((count - 1) * COLUMN_WIDTH) / 2,
        y: l.layer * LAYER_HEIGHT,
      });
    }
    return map;
  }, [layout]);

  // Centers the diagram horizontally in the viewport on first layout.
  useEffect(() => {
    if (positions.size === 0 || !containerRef.current) return;
    const xs = Array.from(positions.values()).map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + CARD_WIDTH;
    const width = containerRef.current.clientWidth;
    setView((v) => ({ ...v, x: width / 2 - (minX + maxX) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.length]);

  // ---- Pan & zoom -----------------------------------------------------
  const panRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);

  function onBackgroundMouseDown(e: React.MouseEvent) {
    panRef.current = { startX: e.clientX, startY: e.clientY, viewX: viewRef.current.x, viewY: viewRef.current.y };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const pan = panRef.current;
      if (!pan) return;
      setView((v) => ({ ...v, x: pan.viewX + (e.clientX - pan.startX), y: pan.viewY + (e.clientY - pan.startY) }));
    }
    function onMouseUp() {
      panRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
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

  const presentTypes = useMemo(() => Array.from(new Set(nodes.map((n) => n.type))), [nodes]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="flow-view">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Flow view</h2>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
        >
          <XIcon />
          Close
        </button>
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
              </defs>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {edges.map((e, i) => {
                  const from = positions.get(e.source);
                  const to = positions.get(e.target);
                  if (!from || !to) return null;
                  const x1 = from.x + CARD_WIDTH / 2;
                  const y1 = from.y + CARD_HEIGHT;
                  const x2 = to.x + CARD_WIDTH / 2;
                  const y2 = to.y;
                  const midY = (y1 + y2) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                      stroke={colors.inkFaint}
                      strokeWidth={1.5}
                      fill="none"
                      markerEnd="url(#flow-arrow)"
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
                return (
                  <button
                    key={l.id}
                    data-testid="flow-card"
                    onClick={() => onSelectNode(l.id)}
                    className="absolute flex flex-col items-start gap-1 overflow-hidden rounded-lg border-(length:--border-w) bg-surface px-3 py-2 text-left shadow-sm transition-shadow hover:shadow-md"
                    style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, height: CARD_HEIGHT, borderColor: typeColor(node.type) }}
                  >
                    <span className="font-mono text-[10px] text-ink-faint">{node.zettelId}</span>
                    <span className="line-clamp-2 text-sm text-ink">{node.title}</span>
                  </button>
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
