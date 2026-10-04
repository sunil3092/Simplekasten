// Pure, I/O-free edge routing for the flow view — the companion to
// flow-layout.ts. Cards can sit anywhere (auto-arranged or dragged), so an
// arrow drawn straight from one card to another may cross a third card and
// read as if it started there. routeFlowEdge() returns a polyline that
// leaves the source card's border, bends around any card in the way, and
// ends on the target card's border.

export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_CLEARANCE = 20;

function center(r: FlowRect): FlowPoint {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function inflate(r: FlowRect, by: number): FlowRect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 };
}

function contains(r: FlowRect, p: FlowPoint): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function distance(a: FlowPoint, b: FlowPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Liang–Barsky clip of segment p→q against the rect's open interior. Returns
 * the entry parameter (0..1) when the segment passes through the inside, or
 * null when it misses, only touches a corner, or runs along an edge.
 */
function segmentEntry(p: FlowPoint, q: FlowPoint, r: FlowRect): number | null {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const deltas = [-dx, dx, -dy, dy];
  const gaps = [p.x - r.x, r.x + r.width - p.x, p.y - r.y, r.y + r.height - p.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (deltas[i] === 0) {
      if (gaps[i] <= 0) return null;
      continue;
    }
    const t = gaps[i] / deltas[i];
    if (deltas[i] < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  return t1 - t0 > 1e-9 ? t0 : null;
}

/** Where the ray from the rect's centre toward `toward` crosses its border. */
function borderPoint(r: FlowRect, toward: FlowPoint): FlowPoint {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scale = Math.min(
    dx === 0 ? Infinity : r.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : r.height / 2 / Math.abs(dy),
  );
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

export function routeFlowEdge(
  from: FlowRect,
  to: FlowRect,
  obstacles: FlowRect[],
  clearance: number = DEFAULT_CLEARANCE,
): FlowPoint[] {
  const start = center(from);
  const end = center(to);
  // A card overlapping either end can't be routed around — skip it rather
  // than send the arrow on a detour that goes nowhere.
  const blockers = obstacles.map((o) => inflate(o, clearance)).filter((b) => !contains(b, start) && !contains(b, end));

  const points = [start, end];
  const maxBends = blockers.length * 4 + 4;
  for (let bend = 0; bend < maxBends; bend++) {
    let found: { segment: number; blocker: FlowRect } | null = null;
    for (let i = 0; i < points.length - 1 && !found; i++) {
      let nearest = Infinity;
      for (const blocker of blockers) {
        const t = segmentEntry(points[i], points[i + 1], blocker);
        if (t !== null && t < nearest) {
          nearest = t;
          found = { segment: i, blocker };
        }
      }
    }
    if (!found) break;

    const p = points[found.segment];
    const q = points[found.segment + 1];
    // Corners sit just outside the blocker so a segment ending on one, or
    // running between two of them, doesn't count as passing through it.
    const b = inflate(found.blocker, 1);
    const corners: FlowPoint[] = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height },
    ].filter((c) => distance(c, p) > 1e-6 && distance(c, q) > 1e-6);
    if (corners.length === 0) break;
    const detour = (c: FlowPoint) => distance(p, c) + distance(c, q);
    corners.sort((a, c) => detour(a) - detour(c));
    points.splice(found.segment + 1, 0, corners[0]);
  }

  points[0] = borderPoint(from, points[1]);
  points[points.length - 1] = borderPoint(to, points[points.length - 2]);
  return points;
}

/** True when any segment of the polyline passes through the rect's inside. */
export function flowPathCrosses(points: FlowPoint[], rect: FlowRect): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentEntry(points[i], points[i + 1], rect) !== null) return true;
  }
  return false;
}
