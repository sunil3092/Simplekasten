import type { NoteVersion } from "@simplekasten/local-engine";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, useDisplayText } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

// Pushed from the note screen's history icon. Mobile shows a read-only
// preview of each version rather than a diff — matches Templates'
// precedent: mobile is a simpler consumer of a desktop-authored feature,
// not a second full implementation.
export default function HistoryScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const { colors, shape } = useTheme();
  const displayText = useDisplayText();
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [selected, setSelected] = useState<{ id: string; title: string; content: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      vault.listNoteVersions(noteId).then(setVersions);
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
          await vault.restoreNoteVersion(noteId, selected.id);
          setSelected(null);
          vault.listNoteVersions(noteId).then(setVersions);
        },
      },
    ]);
  }

  if (selected) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <Text style={[styles.title, displayText]}>{selected.title}</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginBottom: 20 }}>{selected.content || "(empty note)"}</Text>
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
  versionRow: { marginBottom: 8 },
});
