import { COPY } from "@simplekasten/core";
import type { NoteListItem, SearchResultItem, TagItem } from "@simplekasten/local-engine";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button, Chip, fontFamily, SectionHeading } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");

// The engine wraps matches in \u0001...\u0002 sentinels (see searchNotes in
// local-engine) — split on those, same as desktop's QuickSwitcher.
function Snippet({ text }: { text: string }) {
  const { colors } = useTheme();
  const parts = text.split(/[\u0001\u0002]/);
  return (
    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.inkFaint, marginTop: 2 }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ color: colors.accent2, backgroundColor: colors.accent2Soft }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

type Row = { id: string; zettelId: string; title: string; snippet?: string };

export default function VaultScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  // A note screen's tag chip navigates here with ?tag=… to filter the list.
  const params = useLocalSearchParams<{ tag?: string }>();
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (params.tag) {
      setActiveTag(params.tag);
      setQuery("");
      // Consume it, so tapping the same tag on a note again still filters.
      router.setParams({ tag: undefined });
    }
  }, [params.tag, router]);

  const load = useCallback(async (tag?: string | null) => {
    const [noteList, tagList, due] = await Promise.all([
      vault.listNotes(tag ?? undefined),
      vault.listTags(),
      vault.listDueForReview(new Date().toLocaleDateString("en-CA")),
    ]);
    setNotes(noteList);
    setTags(tagList);
    setDueCount(due.length);
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

  // Same debounce and stale-response guard as desktop's QuickSwitcher.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      vault.search(trimmed).then((found) => {
        if (requestIdRef.current === requestId) setResults(found);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  async function onRefresh() {
    setRefreshing(true);
    await load(activeTag);
    setRefreshing(false);
  }

  async function createNote(title = "Untitled") {
    if (creating) return;
    setCreating(true);
    try {
      const note = await vault.createNote({ title, content: "", type: "fleeting" });
      setQuery("");
      router.push(`/vault/${note.id}`);
    } finally {
      setCreating(false);
    }
  }

  // "en-CA" is a locale-format trick that renders as YYYY-MM-DD in the
  // device's local time — not a hardcoded region. Computed on the device
  // since the engine has no notion of the user's timezone.
  async function openToday() {
    if (creating) return;
    setCreating(true);
    try {
      const date = new Date().toLocaleDateString("en-CA");
      const note = await vault.getOrCreateDailyNote(date);
      setQuery("");
      router.push(`/vault/${note.id}`);
    } finally {
      setCreating(false);
    }
  }

  const trimmed = query.trim();
  const searching = trimmed.length > 0;
  const rows: Row[] = searching ? (results ?? []) : notes;
  const exactMatch = rows.some((n) => n.title.toLowerCase() === trimmed.toLowerCase());
  // Structure notes are Maps of Content — surfaced as a standing section, as
  // on desktop, so an index note doesn't get lost once it scrolls away.
  const mapsOfContent = useMemo(() => notes.filter((n) => n.type === "structure"), [notes]);

  const header = (
    <View>
      <View style={[styles.search, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface }]}>
        <Icon name="search" size={18} color={colors.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={COPY.searchPlaceholder}
          placeholderTextColor={colors.inkFaint}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (rows[0]) router.push(`/vault/${rows[0].id}`);
            else if (trimmed && !exactMatch) createNote(trimmed);
          }}
          style={[styles.searchInput, { color: colors.ink }]}
          accessibilityLabel="Search notes"
        />
        {searching && (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery("")}>
            <Icon name="x" size={16} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>

      {!searching && (
        <>
          <View style={styles.actionRow}>
            <Button icon="calendar" label="Today" onPress={openToday} disabled={creating} style={styles.actionButton} />
            <Button
              icon="repeat"
              label={dueCount > 0 ? `Review · ${dueCount}` : "Review"}
              onPress={() => router.push("/review")}
              style={styles.actionButton}
            />
            <Button variant="primary" icon="plus" label={COPY.newNote} onPress={() => createNote()} disabled={creating} style={styles.actionButton} />
          </View>

          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <Chip key={t.id} label={`#${t.name} ${t.noteCount}`} active={activeTag === t.name} onPress={() => setActiveTag(activeTag === t.name ? null : t.name)} />
              ))}
            </View>
          )}

          {mapsOfContent.length > 0 && (
            <View style={styles.maps}>
              <SectionHeading icon="layers">{COPY.mapsOfContent}</SectionHeading>
              {mapsOfContent.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(`/vault/${n.id}`)}
                  style={[styles.mapRow, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line }]}
                >
                  <Text numberOfLines={1} style={{ color: colors.inkMuted, fontSize: 14 }}>
                    {n.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.countRow}>
            <Text style={[styles.count, { color: colors.inkFaint }]}>{COPY.noteCount(notes.length, activeTag).toUpperCase()}</Text>
            {activeTag && (
              <Pressable hitSlop={8} onPress={() => setActiveTag(null)}>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkMuted }}>clear</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          searching ? (
            results === null ? <Text style={[styles.empty, { color: colors.inkFaint }]}>{COPY.searching}</Text> : null
          ) : (
            <Text style={[styles.empty, { color: colors.inkFaint }]}>{COPY.emptyVault}</Text>
          )
        }
        ListFooterComponent={
          searching && results !== null && !exactMatch ? (
            <Pressable onPress={() => createNote(trimmed)} style={styles.createRow} accessibilityRole="button">
              <Icon name="plus" color={colors.accent2} />
              <Text style={{ color: colors.accent2, fontSize: 15 }}>{COPY.createNote(trimmed)}</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/vault/${item.id}`)}
            style={({ pressed }) => [styles.noteRow, { borderColor: colors.lineSoft, backgroundColor: pressed ? colors.surface2 : "transparent" }]}
          >
            <View style={styles.noteLine}>
              <Text style={[styles.zettelId, { color: colors.inkFaint }]}>{item.zettelId}</Text>
              <Text style={[styles.noteTitle, { color: colors.ink }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            {item.snippet && <Snippet text={item.snippet} />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionButton: { flex: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  maps: { marginBottom: 12 },
  mapRow: { borderStyle: "dashed", paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 2 },
  count: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.8 },
  noteRow: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  noteLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  zettelId: { fontSize: 11, fontFamily: MONO, minWidth: 24 },
  noteTitle: { fontSize: 16, flex: 1 },
  createRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
});
