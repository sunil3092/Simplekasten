import type { CanvasListItem } from "@simplekasten/local-engine";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

// Reachable from the vault tab's command palette ("Canvases", alongside
// Today/Review/Graph). Mobile views canvases made on desktop — see
// canvas.md's desktop-authors/mobile-views split.
export default function CanvasListScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      vault.listCanvases().then(setCanvases).catch(() => setCanvases([]));
    }, []),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={canvases ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          canvases === null ? null : <Text style={{ color: colors.inkFaint, fontSize: 14, textAlign: "center", marginTop: 40 }}>No canvases yet — create one on desktop.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/canvas/${item.id}`)}
            style={({ pressed }) => [
              styles.row,
              { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: pressed ? colors.surface2 : colors.surface },
            ]}
          >
            <Icon name="layout" size={18} color={colors.inkFaint} />
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  title: { fontSize: 15, flex: 1 },
});
