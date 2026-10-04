import type { FlowLayoutNode } from "./flow-layout";
import { routeFlowEdge, type FlowPoint, type FlowRect } from "./flow-routing";
import type { GraphEdge } from "./types";

// What the Flow view shows, worked out away from any screen: desktop and
// mobile both draw from these, so a flow is arranged, routed and filtered
// the same way on each.

/**
 * Card geometry. The gaps between cards (80 across, 100 down) are wide
 * enough for an arrow to pass between two neighbours with clearance on both
 * sides.
 */
export const FLOW_CARD = {
  width: 260,
  height: 170,
  columnWidth: 340,
  layerHeight: 270,
  edgeCornerRadius: 18,
} as const;

export type FlowPositions = Map<string, FlowPoint>;

export const flowCardRect = (p: FlowPoint): FlowRect => ({ x: p.x, y: p.y, width: FLOW_CARD.width, height: FLOW_CARD.height });

/** Where the layout alone would put each card: one row per layer, centred on x = 0. */
export function flowAutoPositions(layout: FlowLayoutNode[]): FlowPositions {
  const layerCounts = new Map<number, number>();
  for (const l of layout) layerCounts.set(l.layer, (layerCounts.get(l.layer) ?? 0) + 1);
  const map: FlowPositions = new Map();
  for (const l of layout) {
    const count = layerCounts.get(l.layer) ?? 1;
    map.set(l.id, {
      x: l.order * FLOW_CARD.columnWidth - ((count - 1) * FLOW_CARD.columnWidth) / 2,
      y: l.layer * FLOW_CARD.layerHeight,
    });
  }
  return map;
}

function overlaps(a: FlowPoint, b: FlowPoint): boolean {
  return Math.abs(a.x - b.x) < FLOW_CARD.width && Math.abs(a.y - b.y) < FLOW_CARD.height;
}

/**
 * Cards the user has dragged keep their spot; everything else follows the
 * automatic layout. A remembered spot for a card that isn't showing is
 * ignored.
 */
export function placeFlowCards(auto: FlowPositions, moved: FlowPositions): FlowPositions {
  const map: FlowPositions = new Map();
  const placed: FlowPoint[] = [];
  for (const [id] of auto) {
    const spot = moved.get(id);
    if (spot) {
      map.set(id, spot);
      placed.push(spot);
    }
  }
  // An automatic slot may now be under a card the user parked there — step
  // sideways until it is free rather than stacking two cards.
  for (const [id, slot] of auto) {
    if (map.has(id)) continue;
    let spot = slot;
    for (let tries = 0; tries < 50 && placed.some((p) => overlaps(p, spot)); tries++) {
      spot = { x: spot.x + FLOW_CARD.columnWidth, y: spot.y };
    }
    map.set(id, spot);
    placed.push(spot);
  }
  // Same order as the layout, whichever pass placed the card.
  return new Map(Array.from(auto.keys(), (id) => [id, map.get(id)!] as const));
}

/** SVG path through the points, with the bends rounded off. */
export function roundedFlowPath(points: FlowPoint[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(FLOW_CARD.edgeCornerRadius, inLength / 2, outLength / 2);
    if (r === 0) continue;
    const before = { x: corner.x - ((corner.x - prev.x) / inLength) * r, y: corner.y - ((corner.y - prev.y) / inLength) * r };
    const after = { x: corner.x + ((next.x - corner.x) / outLength) * r, y: corner.y + ((next.y - corner.y) / outLength) * r };
    d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export interface FlowRoute {
  source: string;
  target: string;
  /** SVG path data, in the same coordinates as the card positions. */
  d: string;
}

/** One arrow per link between two cards that are both showing, bent around the cards in between. */
export function flowRoutes(edges: GraphEdge[], positions: FlowPositions): FlowRoute[] {
  const rects = new Map(Array.from(positions, ([id, p]) => [id, flowCardRect(p)] as const));
  return edges.flatMap((e) => {
    const from = rects.get(e.source);
    const to = rects.get(e.target);
    if (!from || !to || e.source === e.target) return [];
    const others = Array.from(rects)
      .filter(([id]) => id !== e.source && id !== e.target)
      .map(([, rect]) => rect);
    return [{ source: e.source, target: e.target, d: roundedFlowPath(routeFlowEdge(from, to, others)) }];
  });
}

// Filter value for notes carrying no tag at all. Not a valid tag name, so it
// can never collide with a real one.
export const FLOW_UNTAGGED = "\u0000untagged";

export interface FlowFilter {
  filterTags: string[];
  hideJournal: boolean;
  /** A card to keep showing whatever its tags — the one being typed in. */
  keepId: string | null;
}

/**
 * A note shows when it carries any of the chosen tags. The card being typed
 * in stays on screen even if its tags stop matching — otherwise retyping a
 * #hashtag would whisk it away mid-edit.
 */
export function filterFlowNodes<T extends { id: string; type: string }>(nodes: T[], noteTags: Map<string, string[]>, { filterTags, hideJournal, keepId }: FlowFilter): T[] {
  if (filterTags.length === 0 && !hideJournal) return nodes;
  return nodes.filter((n) => {
    if (n.id === keepId) return true;
    if (hideJournal && n.type === "daily") return false;
    if (filterTags.length === 0) return true;
    const tags = noteTags.get(n.id) ?? [];
    return tags.length === 0 ? filterTags.includes(FLOW_UNTAGGED) : tags.some((t) => filterTags.includes(t));
  });
}

export interface FlowTagOption {
  value: string;
  label: string;
  count: number;
}

/** Every tag on the flow with how many notes carry it, by name; "Untagged" last when some notes have none. */
export function flowTagOptions(noteTags: Map<string, string[]>): FlowTagOption[] {
  const counts = new Map<string, number>();
  let untagged = 0;
  for (const tags of noteTags.values()) {
    if (tags.length === 0) untagged++;
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const options: FlowTagOption[] = Array.from(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, count]) => ({ value: tag, label: `#${tag}`, count }));
  if (untagged > 0) options.push({ value: FLOW_UNTAGGED, label: "Untagged", count: untagged });
  return options;
}
