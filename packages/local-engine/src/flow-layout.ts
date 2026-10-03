import type { GraphEdge, GraphNode } from "./types";

// Pure, I/O-free layered-DAG layout — no FileSystemAdapter needed, same
// reasoning diff.ts and srs.ts get their own files: the algorithm is the
// part most worth getting right in isolation before any UI touches it.
//
// Turns the same nodes/edges getGraph() already returns into a top-to-
// bottom "function block diagram" reading: each node gets a layer (how
// many hops down from a root) and an order within that layer, Sugiyama-
// style —
//   1. break cycles (a DFS back-edge is dropped, same standard
//      feedback-arc-set technique used to make any directed graph
//      layerable),
//   2. assign layers by longest path on the now-acyclic edge set (so an
//      edge always points from a shallower layer to a deeper one),
//   3. order each layer by the average order of its parents in the layer
//      above (a single-pass barycenter heuristic) to keep related
//      branches visually grouped, without a full crossing-minimization
//      pass.

export interface FlowLayoutNode {
  id: string;
  layer: number;
  order: number;
}

function removeCycles(ids: string[], edges: GraphEdge[]): GraphEdge[] {
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) children.get(e.source)?.push(e.target);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const acyclic: GraphEdge[] = [];

  function visit(id: string) {
    color.set(id, GRAY);
    for (const next of children.get(id) ?? []) {
      const state = color.get(next);
      if (state === GRAY) continue; // back edge — closes a cycle, drop it
      acyclic.push({ source: id, target: next });
      if (state === WHITE) visit(next);
    }
    color.set(id, BLACK);
  }

  for (const id of ids) {
    if (color.get(id) === WHITE) visit(id);
  }
  return acyclic;
}

function longestPathLayers(ids: string[], acyclicEdges: GraphEdge[]): Map<string, number> {
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of acyclicEdges) {
    children.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  const remaining = new Map(indegree);
  const queue = ids.filter((id) => indegree.get(id) === 0);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const child of children.get(id) ?? []) {
      layer.set(child, Math.max(layer.get(child)!, layer.get(id)! + 1));
      const left = remaining.get(child)! - 1;
      remaining.set(child, left);
      if (left === 0) queue.push(child);
    }
  }
  return layer;
}

export function layoutFlow(nodes: GraphNode[], edges: GraphEdge[]): FlowLayoutNode[] {
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const validEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target);

  const acyclic = removeCycles(ids, validEdges);
  const layer = longestPathLayers(ids, acyclic);

  const parentsOf = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of acyclic) parentsOf.get(e.target)?.push(e.source);

  const maxLayer = ids.length === 0 ? -1 : Math.max(...ids.map((id) => layer.get(id)!));
  const order = new Map<string, number>();
  let previousLayerOrder = new Map<string, number>();

  for (let l = 0; l <= maxLayer; l++) {
    const layerIds = ids.filter((id) => layer.get(id) === l);
    const barycenter = (id: string) => {
      const parents = parentsOf.get(id) ?? [];
      if (parents.length === 0) return Number.MAX_SAFE_INTEGER;
      return parents.reduce((sum, p) => sum + (previousLayerOrder.get(p) ?? 0), 0) / parents.length;
    };
    const sorted = layerIds.slice().sort((a, b) => barycenter(a) - barycenter(b) || a.localeCompare(b));
    const layerOrder = new Map<string, number>();
    sorted.forEach((id, i) => {
      order.set(id, i);
      layerOrder.set(id, i);
    });
    previousLayerOrder = layerOrder;
  }

  return ids.map((id) => ({ id, layer: layer.get(id)!, order: order.get(id) ?? 0 }));
}
