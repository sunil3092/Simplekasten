"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

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

const TYPE_COLORS: Record<string, string> = {
  fleeting: "#8b9481",
  literature: "#93602a",
  permanent: "#2e6f5a",
  structure: "#57614f",
};

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" data-testid="graph-view">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold text-ink">Graph view</h2>
        <div className="flex items-center gap-2">
          {activeNoteId && (
            <div className="flex rounded-md border border-line text-xs">
              <button
                onClick={() => setScope("local")}
                className={`rounded-l-md px-3 py-1 ${scope === "local" ? "bg-accent-soft text-accent-ink" : "text-ink-muted"}`}
              >
                This note
              </button>
              <button
                onClick={() => setScope("vault")}
                className={`rounded-r-md px-3 py-1 ${scope === "vault" ? "bg-accent-soft text-accent-ink" : "text-ink-muted"}`}
              >
                Whole vault
              </button>
            </div>
          )}
          <button onClick={onClose} className="rounded-md border border-line px-3 py-1 text-sm text-ink-muted hover:border-accent">
            Close
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1">
        {size.width > 0 && graphData.nodes.length > 0 && (
          <ForceGraph2D
            graphData={graphData}
            width={size.width}
            height={size.height}
            nodeId="id"
            nodeLabel="title"
            nodeRelSize={5}
            nodeColor={(node: object) => TYPE_COLORS[(node as GraphNode).type] ?? TYPE_COLORS.fleeting}
            linkColor={() => "#8b948155"}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: object) => onSelectNode((node as GraphNode).id)}
            backgroundColor="rgba(0,0,0,0)"
          />
        )}
        {graphData.nodes.length === 0 && (
          <p className="flex h-full items-center justify-center text-sm text-ink-faint">Nothing to graph yet.</p>
        )}
      </div>
    </div>
  );
}
