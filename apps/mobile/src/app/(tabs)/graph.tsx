import { COPY } from "@simplekasten/core";
import type { GraphData, GraphEdge, GraphNode } from "@simplekasten/local-engine";
import { noteTypeInfo } from "@simplekasten/themes";
import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { Circle, G, Line, Svg, Text as SvgText } from "react-native-svg";
import { SegmentedControl } from "@/components/ui";
import { getLastNote } from "@/lib/lastNote";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type LaidOutNode = GraphNode & SimulationNodeDatum & { x: number; y: number };

const NODE_RADIUS = 9;
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
// A touch that moves less than this is a tap on a node, not a pan.
const TAP_SLOP = 6;

// A fixed tick count settles a static layout instead of running a live
// physics loop — good enough for a note graph at personal-vault scale.
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): LaidOutNode[] {
  const laidOut: LaidOutNode[] = nodes.map((n) => ({ ...n }) as LaidOutNode);
  const links: SimulationLinkDatum<LaidOutNode>[] = edges.map((e) => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(laidOut)
    .force("charge", forceManyBody().strength(-160))
    .force(
      "link",
      forceLink<LaidOutNode, SimulationLinkDatum<LaidOutNode>>(links)
        .id((n) => n.id)
        .distance(80),
    )
    .force("center", forceCenter(width / 2, height / 2))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  return laidOut;
}

// Same "This note" filter as desktop's GraphView: the note plus everything
// one link away in either direction.
function localNeighborhoodIds(edges: GraphEdge[], activeNoteId: string): Set<string> {
  const ids = new Set([activeNoteId]);
  for (const edge of edges) {
    if (edge.source === activeNoteId) ids.add(edge.target);
    if (edge.target === activeNoteId) ids.add(edge.source);
  }
  return ids;
}

function shortTitle(title: string) {
  return title.length > 18 ? `${title.slice(0, 17)}…` : title;
}

function touchDistance(e: GestureResponderEvent) {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export default function GraphScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [scope, setScope] = useState<"local" | "vault">("vault");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  useFocusEffect(
    useCallback(() => {
      const last = getLastNote();
      setActiveNoteId(last);
      // Opening the graph after visiting a note starts on that note's
      // neighbourhood, as desktop does when a note is open.
      setScope(last ? "local" : "vault");
      setView({ x: 0, y: 0, scale: 1 });
      vault.getGraph().then(setGraph).catch(() => {});
    }, []),
  );

  const visible = useMemo(() => {
    if (!graph) return null;
    const hasActive = activeNoteId && graph.nodes.some((n) => n.id === activeNoteId);
    if (scope === "vault" || !hasActive) return graph;
    const ids = localNeighborhoodIds(graph.edges, activeNoteId);
    return {
      nodes: graph.nodes.filter((n) => ids.has(n.id)),
      edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  }, [graph, scope, activeNoteId]);

  const nodes = useMemo(
    () => (visible && size.width > 0 ? layoutGraph(visible.nodes, visible.edges, size.width, size.height) : []),
    [visible, size],
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const presentTypes = useMemo(() => Array.from(new Set(nodes.map((n) => n.type))), [nodes]);

  // ---- Pan & pinch-zoom ----------------------------------------------------
  // Plain PanResponder (no gesture-handler dependency): one finger pans, two
  // fingers pinch around their midpoint, and a touch that barely moves is a
  // tap that opens the nearest node under it.
  const viewRef = useRef(view);
  viewRef.current = view;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const gesture = useRef({ start: view, pinchStart: 0, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gesture.current = { start: viewRef.current, pinchStart: 0, moved: false };
        },
        onPanResponderMove: (e, g) => {
          const start = gesture.current.start;
          if (e.nativeEvent.touches.length >= 2) {
            gesture.current.moved = true;
            const distance = touchDistance(e);
            if (!gesture.current.pinchStart) {
              gesture.current = { start: viewRef.current, pinchStart: distance, moved: true };
              return;
            }
            const [a, b] = e.nativeEvent.touches;
            const midX = (a.locationX + b.locationX) / 2;
            const midY = (a.locationY + b.locationY) / 2;
            const s0 = gesture.current.start;
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0.scale * (distance / gesture.current.pinchStart)));
            // Keep the point under the fingers' midpoint fixed while scaling.
            const k = scale / s0.scale;
            setView({ scale, x: midX - (midX - s0.x) * k, y: midY - (midY - s0.y) * k });
            return;
          }
          if (Math.hypot(g.dx, g.dy) > TAP_SLOP) gesture.current.moved = true;
          if (gesture.current.moved && !gesture.current.pinchStart) setView({ ...start, x: start.x + g.dx, y: start.y + g.dy });
        },
        onPanResponderRelease: (e) => {
          if (gesture.current.moved) return;
          const { locationX, locationY } = e.nativeEvent;
          const v = viewRef.current;
          const gx = (locationX - v.x) / v.scale;
          const gy = (locationY - v.y) / v.scale;
          let best: LaidOutNode | null = null;
          let bestDistance = (NODE_RADIUS + 14) / v.scale;
          for (const n of nodesRef.current) {
            const d = Math.hypot(n.x - gx, n.y - gy);
            if (d < bestDistance) {
              best = n;
              bestDistance = d;
            }
          }
          if (best) router.push(`/vault/${best.id}`);
        },
      }),
    [router],
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  }

  if (!graph) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  const hasActive = !!activeNoteId && graph.nodes.some((n) => n.id === activeNoteId);
  const typeColor = (type: string) => colors[noteTypeInfo(type).graphColor];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {hasActive && (
        <View style={styles.toolbar}>
          <SegmentedControl
            value={scope}
            onChange={(next) => {
              setScope(next);
              setView({ x: 0, y: 0, scale: 1 });
            }}
            options={[
              { value: "local", label: "This note" },
              { value: "vault", label: "Whole vault" },
            ]}
          />
        </View>
      )}

      <View style={styles.canvas} onLayout={onLayout} {...responder.panHandlers} accessibilityLabel="Note graph. Drag to pan, pinch to zoom, tap a node to open it.">
        {nodes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.inkFaint }]}>{COPY.emptyGraph}</Text>
        ) : (
          <Svg width={size.width} height={size.height} pointerEvents="none">
            <G transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
              {(visible?.edges ?? []).map((edge, i) => {
                const a = nodeById.get(edge.source);
                const b = nodeById.get(edge.target);
                if (!a || !b) return null;
                return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.inkFaint} strokeWidth={1.5 / view.scale} />;
              })}
              {nodes.map((n) => (
                <Circle
                  key={n.id}
                  cx={n.x}
                  cy={n.y}
                  r={NODE_RADIUS}
                  fill={typeColor(n.type)}
                  stroke={n.id === activeNoteId ? colors.accent : colors.surface}
                  strokeWidth={n.id === activeNoteId ? 3 : 1.5}
                />
              ))}
              {nodes.map((n) => (
                <SvgText key={`${n.id}-label`} x={n.x} y={n.y + NODE_RADIUS + 13} fontSize={11} fill={colors.inkMuted} textAnchor="middle">
                  {shortTitle(n.title)}
                </SvgText>
              ))}
            </G>
          </Svg>
        )}
      </View>

      {presentTypes.length > 0 && (
        <View
          pointerEvents="none"
          style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius }]}
        >
          {presentTypes.map((type) => (
            <View key={type} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: typeColor(type) }]} />
              <Text style={{ fontSize: 12, color: colors.inkMuted }}>{noteTypeInfo(type).label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { alignItems: "center", paddingTop: 12 },
  canvas: { flex: 1, overflow: "hidden", justifyContent: "center" },
  empty: { textAlign: "center", fontSize: 14, paddingHorizontal: 24 },
  legend: { position: "absolute", left: 16, bottom: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
