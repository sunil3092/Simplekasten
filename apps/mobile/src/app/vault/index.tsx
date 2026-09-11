import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@simplekasten/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { getRefreshToken } from "@/lib/session";
import { trpc } from "@/lib/trpc";
import { useThemeColors } from "@/theme";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type KnowledgeBase = RouterOutputs["knowledgeBase"]["list"][number];
type NoteListItem = RouterOutputs["note"]["list"][number];
type TagItem = RouterOutputs["tag"]["list"][number];

export default function VaultScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { logout } = useAuth();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (tag?: string | null) => {
    // v1 scope: the mobile app works in the account's default vault only —
    // no vault-switching UI yet, matching this build's documented scoping.
    const kbs = await trpc.knowledgeBase.list.query();
    const current = kbs[0] ?? null;
    setKb(current);
    if (!current) return;
    const [noteList, tagList] = await Promise.all([
      trpc.note.list.query({ kbId: current.id, tag: tag ?? undefined }),
      trpc.tag.list.query({ kbId: current.id }),
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
      // An in-flight load can still outlive a race with a force-logout — a
      // swallowed error here is preferable to an unhandled rejection
      // reaching the dev error overlay for something already navigated away from.
      load(activeTag).catch(() => {});
    }, [activeTag, load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(activeTag);
    setRefreshing(false);
  }

  async function createNote() {
    if (!kb || creating) return;
    setCreating(true);
    try {
      const note = await trpc.note.create.mutate({ kbId: kb.id, title: "Untitled", content: "", type: "fleeting" });
      router.push(`/vault/${note.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function onLogout() {
    const refreshToken = await getRefreshToken();
    if (refreshToken) trpc.auth.logout.mutate({ refreshToken }).catch(() => {});
    await logout();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.vaultName, { color: colors.inkMuted }]}>{kb?.name ?? "Simplekasten"}</Text>
        <Pressable onPress={onLogout}>
          <Text style={[styles.logout, { color: colors.inkFaint }]}>Log out</Text>
        </Pressable>
      </View>

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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  vaultName: { fontSize: 13, fontFamily: "monospace" },
  logout: { fontSize: 13, textDecorationLine: "underline" },
  newNoteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  noteRow: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#00000010" },
  zettelId: { fontSize: 11, fontFamily: "monospace", width: 24 },
  noteTitle: { fontSize: 16, flex: 1 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
});
