import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Circle, Line, Svg, Text as SvgText } from "react-native-svg";
import type { GraphData, GraphNode } from "@simplekasten/local-engine";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type LaidOutNode = GraphNode & SimulationNodeDatum & { x: number; y: number };

// A fixed tick count settles a static layout instead of running a live
// physics loop — good enough for a note graph at personal-vault scale. No
// pan/zoom yet either: add both if graphs grow large enough to need them.
function layoutGraph(graph: GraphData, width: number, height: number): LaidOutNode[] {
  const nodes: LaidOutNode[] = graph.nodes.map((n) => ({ ...n }) as LaidOutNode);
  const links: SimulationLinkDatum<LaidOutNode>[] = graph.edges.map((e) => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-120))
    .force(
      "link",
      forceLink<LaidOutNode, SimulationLinkDatum<LaidOutNode>>(links)
        .id((n) => n.id)
        .distance(70),
    )
    .force("center", forceCenter(width / 2, height / 2))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  return nodes;
}

export default function GraphScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [graph, setGraph] = useState<GraphData | null>(null);

  useFocusEffect(
    useCallback(() => {
      vault.getGraph().then(setGraph).catch(() => {});
    }, []),
  );

  if (!graph) return null;

  if (graph.nodes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.empty, { color: colors.inkFaint }]}>
          Your vault is empty — create a note to see it here.
        </Text>
      </View>
    );
  }

  const { width } = Dimensions.get("window");
  const size = width - 32;
  const nodes = layoutGraph(graph, size, size);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Svg width={size} height={size}>
        {graph.edges.map((edge, i) => {
          const a = nodeById.get(edge.source);
          const b = nodeById.get(edge.target);
          if (!a || !b) return null;
          return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.line} strokeWidth={1.5} />;
        })}
        {nodes.map((n) => (
          <Circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={16}
            fill={colors.accentSoft}
            stroke={colors.accent}
            strokeWidth={2}
            onPress={() => router.push(`/vault/${n.id}`)}
          />
        ))}
        {nodes.map((n) => (
          <SvgText key={`${n.id}-label`} x={n.x} y={n.y + 28} fontSize={10} fill={colors.inkMuted} textAnchor="middle">
            {n.zettelId}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  empty: { textAlign: "center", fontSize: 14, paddingHorizontal: 24 },
});
