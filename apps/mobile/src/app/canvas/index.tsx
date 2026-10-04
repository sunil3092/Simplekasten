import type { CanvasListItem } from "@simplekasten/local-engine";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

// Reachable from the vault tab's command list ("Canvases", alongside
// Today/Review/Graph). Canvases are listed, made and opened here.
export default function CanvasListScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasListItem[] | null>(null);
  // Non-null while a new canvas is being named.
  const [naming, setNaming] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      vault.listCanvases().then(setCanvases).catch(() => setCanvases([]));
    }, []),
  );

  // Create and the keyboard's Done can both fire; only one canvas is made.
  const creatingRef = useRef(false);
  async function create() {
    if (naming === null || creatingRef.current) return;
    creatingRef.current = true;
    try {
      // Same fallback name desktop gives an unnamed canvas.
      const canvas = await vault.createCanvas({ title: naming.trim() || "Untitled canvas" });
      setNaming(null);
      router.push(`/canvas/${canvas.id}`);
    } finally {
      creatingRef.current = false;
    }
  }

  const box = { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={canvases ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          naming === null ? (
            <Button variant="primary" icon="plus" label="New canvas" onPress={() => setNaming("")} style={styles.newButton} />
          ) : (
            <View style={styles.form}>
              <TextInput
                accessibilityLabel="Canvas name"
                value={naming}
                onChangeText={setNaming}
                onSubmitEditing={create}
                placeholder="Canvas name"
                placeholderTextColor={colors.inkFaint}
                autoFocus
                returnKeyType="done"
                style={[box, styles.input, { color: colors.ink, backgroundColor: colors.surface }]}
              />
              <Button variant="ghost" label="Cancel" onPress={() => setNaming(null)} />
              <Button variant="primary" label="Create" onPress={create} />
            </View>
          )
        }
        ListEmptyComponent={canvases === null ? null : <Text style={{ color: colors.inkFaint, fontSize: 14, textAlign: "center", marginTop: 40 }}>No canvases yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/canvas/${item.id}`)}
            style={({ pressed }) => [styles.row, box, { backgroundColor: pressed ? colors.surface2 : colors.surface }]}
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
  newButton: { alignSelf: "flex-start", marginBottom: 8 },
  form: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  title: { fontSize: 15, flex: 1 },
});
