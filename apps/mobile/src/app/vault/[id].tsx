import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vaultvista/api";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { useThemeColors } from "@/theme";

type NoteDetail = inferRouterOutputs<AppRouter>["note"]["getById"];
type NoteType = NoteDetail["type"];

const TYPES: { value: NoteType; label: string }[] = [
  { value: "fleeting", label: "Fleeting" },
  { value: "literature", label: "Literature" },
  { value: "permanent", label: "Permanent" },
  { value: "structure", label: "Structure" },
];

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const navigation = useNavigation();

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("fleeting");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trpc.note.getById.query({ id }).then((detail) => {
      setNote(detail);
      setTitle(detail.title);
      setContent(detail.content);
      setType(detail.type);
      setStatus("saved");
    });
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ title: title || "Untitled" });
  }, [navigation, title]);

  function scheduleSave(next: { title: string; content: string; type: NoteType }) {
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      await trpc.note.update.mutate({ id, ...next });
      const fresh = await trpc.note.getById.query({ id });
      setNote(fresh);
      setStatus("saved");
    }, 600);
  }

  function onTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value, content, type });
  }

  function onContentChange(value: string) {
    setContent(value);
    scheduleSave({ title, content: value, type });
  }

  function onTypeChange(value: NoteType) {
    setType(value);
    scheduleSave({ title, content, type: value });
  }

  if (!note) return null;

  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => onTypeChange(t.value)}
              style={[
                styles.typePill,
                {
                  borderColor: type === t.value ? colors.accent : colors.line,
                  backgroundColor: type === t.value ? colors.accentSoft : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 10, color: type === t.value ? colors.accentInk : colors.inkFaint }}>
                {t.label.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 11, color: colors.inkFaint }}>{status === "saving" ? "Saving…" : "Saved"}</Text>
      </View>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="Untitled"
        placeholderTextColor={colors.inkFaint}
        style={[styles.titleInput, { color: colors.ink }]}
      />

      <TextInput
        value={content}
        onChangeText={onContentChange}
        placeholder="Start writing… use [[Note Title]] to link."
        placeholderTextColor={colors.inkFaint}
        multiline
        textAlignVertical="top"
        style={[styles.contentInput, { color: colors.ink }]}
      />

      {note.tagNames.length > 0 && (
        <View style={styles.tagRow}>
          {note.tagNames.map((name) => (
            <View key={name} style={[styles.tagChip, { borderColor: colors.line }]}>
              <Text style={{ fontSize: 11, color: colors.inkMuted }}>#{name}</Text>
            </View>
          ))}
        </View>
      )}

      {type === "structure" && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.inkFaint }]}>CONTENTS ({note.contents.length})</Text>
          {note.contents.map((item, i) => (
            <Pressable
              key={item.noteId ?? `${item.title}-${i}`}
              disabled={!item.noteId}
              onPress={() => item.noteId && router.push(`/vault/${item.noteId}`)}
              style={[styles.linkRow, { borderColor: item.resolved ? colors.line : colors.line, borderStyle: item.resolved ? "solid" : "dashed" }]}
            >
              <Text style={{ color: item.resolved ? colors.ink : colors.inkFaint, fontSize: 14 }}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.inkFaint }]}>LINKED MENTIONS ({note.backlinks.length})</Text>
        {note.backlinks.length === 0 ? (
          <Text style={{ color: colors.inkFaint, fontSize: 13 }}>Nothing links here yet.</Text>
        ) : (
          note.backlinks.map((b) => (
            <Pressable key={b.noteId} onPress={() => router.push(`/vault/${b.noteId}`)} style={[styles.linkRow, { borderColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontSize: 14 }}>{b.title}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flexShrink: 1 },
  typePill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  titleInput: { fontSize: 26, fontWeight: "700", marginBottom: 12, padding: 0 },
  contentInput: { fontSize: 16, lineHeight: 24, minHeight: 200, padding: 0 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5, marginBottom: 8 },
  linkRow: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
});
