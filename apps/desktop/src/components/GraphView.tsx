"use client";

import { COPY } from "@simplekasten/core";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { noteTypeInfo } from "../lib/noteTypes";
import { XIcon } from "./icons";
import { SegmentedControl } from "./ui";

// react-force-graph-2d touches `window`/canvas at import time, so it can only
// ever run client-side — Next would otherwise try to evaluate it during the
// static export build and fail.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export interface GraphNode {
  id: string;
  title: string;
  zettelId: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNoteId?: string;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

// Every note that's within one link (in either direction) of the active
// note. Used by the "This note" filter — the plan's mitigation for graphs
// degrading at scale is to default to a note's local neighborhood rather
// than rendering the whole vault.
function localNeighborhoodIds(edges: GraphEdge[], activeNoteId: string): Set<string> {
  const ids = new Set([activeNoteId]);
  for (const edge of edges) {
    if (edge.source === activeNoteId) ids.add(edge.target);
    if (edge.target === activeNoteId) ids.add(edge.source);
  }
  return ids;
}

export function GraphView({ nodes, edges, activeNoteId, onSelectNode, onClose }: GraphViewProps) {
  const [scope, setScope] = useState<"local" | "vault">(activeNoteId ? "local" : "vault");
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  // The canvas can't read CSS variables, so it takes its colours from the active theme.
  const { colors } = useTheme().resolved;
  const typeColor = (type: string) => colors[noteTypeInfo(type).graphColor];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const graphData = useMemo(() => {
    if (scope === "vault" || !activeNoteId) {
      return { nodes: nodes.map((n) => ({ ...n })), links: edges.map((e) => ({ ...e })) };
    }
    const ids = localNeighborhoodIds(edges, activeNoteId);
    return {
      nodes: nodes.filter((n) => ids.has(n.id)).map((n) => ({ ...n })),
      links: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })),
    };
  }, [nodes, edges, scope, activeNoteId]);

  const presentTypes = useMemo(() => Array.from(new Set(graphData.nodes.map((n) => n.type))), [graphData.nodes]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="graph-view">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Graph view</h2>
        <div className="flex items-center gap-3">
          {activeNoteId && (
            <SegmentedControl
              value={scope}
              onChange={setScope}
              options={[
                { value: "local", label: "This note" },
                { value: "vault", label: "Whole vault" },
              ]}
            />
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <XIcon />
            Close
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {size.width > 0 && graphData.nodes.length > 0 && (
          <ForceGraph2D
            graphData={graphData}
            width={size.width}
            height={size.height}
            nodeId="id"
            nodeLabel="title"
            nodeRelSize={5}
            nodeColor={(node: object) => typeColor((node as GraphNode).type)}
            linkColor={() => colors.inkFaint}
            linkWidth={1.5}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: object) => onSelectNode((node as GraphNode).id)}
            backgroundColor="rgba(0,0,0,0)"
          />
        )}
        {graphData.nodes.length === 0 && (
          <p className="flex h-full items-center justify-center text-sm text-ink-faint">{COPY.emptyGraph}</p>
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
