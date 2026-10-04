import { diffLines, type NoteVersion } from "@simplekasten/local-engine";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, fontFamily, useDisplayText } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");

// Pushed from the note screen's history icon. Picking a version shows what
// has changed since it, line by line, as desktop's version history does.
export default function HistoryScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const { colors, shape } = useTheme();
  const displayText = useDisplayText();
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [selected, setSelected] = useState<{ id: string; title: string; content: string } | null>(null);
  const [currentContent, setCurrentContent] = useState("");

  useFocusEffect(
    useCallback(() => {
      vault.listNoteVersions(noteId).then(setVersions);
      vault.getNoteById(noteId).then((note) => setCurrentContent(note?.content ?? ""));
      setSelected(null);
    }, [noteId]),
  );

  async function selectVersion(versionId: string) {
    const snapshot = await vault.getNoteVersion(noteId, versionId);
    setSelected({ id: versionId, title: snapshot.title, content: snapshot.content });
  }

  function confirmRestore() {
    if (!selected) return;
    Alert.alert("Restore this version?", "The note's current content will be replaced with this version's. Its current state is saved as a new version first, so this can be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        style: "destructive",
        onPress: async () => {
          const restored = await vault.restoreNoteVersion(noteId, selected.id);
          setCurrentContent(restored.content);
          setSelected(null);
          vault.listNoteVersions(noteId).then(setVersions);
        },
      },
    ]);
  }

  if (selected) {
    const diff = diffLines(selected.content, currentContent);
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <Text style={[styles.title, displayText]}>{selected.title}</Text>
        {/* The selected (older) version against the note as it is now: added
            lines were written since that snapshot, struck-through lines were
            removed since — so restoring would bring them back. */}
        <View accessibilityLabel="Changes since this version" style={[styles.diff, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface }]}>
          {diff.length === 0 && <Text style={{ color: colors.inkFaint, fontSize: 13 }}>No changes since this version.</Text>}
          {diff.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.diffLine,
                line.op === "insert"
                  ? { backgroundColor: colors.accentSoft, color: colors.accentInk }
                  : line.op === "delete"
                    ? { backgroundColor: colors.dangerSoft, color: colors.danger, textDecorationLine: "line-through" }
                    : { color: colors.inkMuted },
              ]}
            >
              {line.op === "insert" ? "+ " : line.op === "delete" ? "- " : "  "}
              {line.text || " "}
            </Text>
          ))}
        </View>
        <View style={styles.row}>
          <Button label="Back to list" onPress={() => setSelected(null)} style={{ flex: 1 }} />
          <Button variant="danger" label="Restore" onPress={confirmRestore} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, flex: 1 }]}>
      {versions === null && <Text style={{ color: colors.inkFaint, fontSize: 14 }}>Loading…</Text>}
      {versions?.length === 0 && <Text style={{ color: colors.inkFaint, fontSize: 14 }}>No earlier versions yet.</Text>}
      {versions?.map((v) => (
        <View key={v.id} style={[styles.versionRow, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line }]}>
          <Button label={new Date(v.createdAt).toLocaleString()} onPress={() => selectVersion(v.id)} style={{ width: "100%" }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  diff: { padding: 10, marginBottom: 20 },
  diffLine: { fontFamily: MONO, fontSize: 12, lineHeight: 19 },
  versionRow: { marginBottom: 8 },
});
