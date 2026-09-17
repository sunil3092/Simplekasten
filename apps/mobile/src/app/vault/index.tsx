import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { vault } from "@/lib/vault";
import { useThemeColors } from "@/theme";

interface NoteListItem { id: string; zettelId: string; title: string; type: "fleeting" | "literature" | "permanent" | "structure"; updatedAt: string }
interface TagItem { id: string; name: string; noteCount: number }

export default function VaultScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (tag?: string | null) => {
    const [noteList, tagList] = await Promise.all([
      vault.listNotes(tag ?? undefined) as Promise<NoteListItem[]>,
      vault.listTags() as Promise<TagItem[]>,
    ]);
    setNotes(noteList);
    setTags(tagList);
  }, []);

  // A plain effect only fires on mount/dep-change, not when navigating back
  // here from a pushed note screen — the stack keeps this screen mounted the
  // whole time, so a bare useEffect would leave a note you just created
  // missing from the list until some other state change happened to
  // refetch it. useFocusEffect re-runs every time this screen regains focus,
  // covering that return-from-detail case as well as the initial mount.
  useFocusEffect(
    useCallback(() => {
      load(activeTag).catch(() => {});
    }, [activeTag, load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(activeTag);
    setRefreshing(false);
  }

  async function createNote() {
    if (creating) return;
    setCreating(true);
    try {
      const note = (await vault.createNote({ title: "Untitled", content: "", type: "fleeting" })) as { id: string };
      router.push(`/vault/${note.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Pressable
        onPress={createNote}
        disabled={creating}
        style={[styles.newNoteButton, { borderColor: colors.accent, opacity: creating ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "600" }}>+ New note</Text>
      </Pressable>

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setActiveTag(activeTag === t.name ? null : t.name)}
              style={[
                styles.tagChip,
                {
                  borderColor: activeTag === t.name ? colors.accent2 : colors.line,
                  backgroundColor: activeTag === t.name ? colors.accent2Soft : "transparent",
                },
              ]}
            >
              <Text style={{ color: activeTag === t.name ? colors.accent2 : colors.inkMuted, fontSize: 12 }}>
                #{t.name} {t.noteCount}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.inkFaint }]}>
            Your vault is empty — create the first note to get started.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/vault/${item.id}`)} style={styles.noteRow}>
            <Text style={[styles.zettelId, { color: colors.inkFaint }]}>{item.zettelId}</Text>
            <Text style={[styles.noteTitle, { color: colors.ink }]} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  newNoteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  noteRow: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#00000010" },
  zettelId: { fontSize: 11, fontFamily: "monospace", width: 24 },
  noteTitle: { fontSize: 16, flex: 1 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
});
