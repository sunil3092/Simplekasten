import type { Template } from "@simplekasten/local-engine";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, EmptyHint, fontFamily, IconButton, SectionHeading } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");

// "new" starts the create form; a template id edits that template; null
// shows the plain list — the same three states as desktop's TemplatesModal.
type Editing = "new" | string | null;

// Pushed from the vault tab's command list. Templates are made, edited,
// deleted and chosen as the daily default here, as on desktop; inserting one
// into a note stays on the note screen.
export default function TemplatesScreen() {
  const { colors, shape } = useTheme();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const refresh = useCallback(() => vault.listTemplates().then(setTemplates), []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function startEditing(next: Editing) {
    const template = next && next !== "new" ? templates?.find((t) => t.id === next) : undefined;
    setName(template?.name ?? "");
    setContent(template?.content ?? "");
    setEditing(next);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing === "new") await vault.createTemplate({ name: trimmed, content });
    else if (editing) await vault.updateTemplate({ id: editing, name: trimmed, content });
    setEditing(null);
    await refresh();
  }

  function confirmDelete(template: Template) {
    Alert.alert("Delete this template?", `“${template.name}” will be removed. Notes already made from it are not changed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await vault.deleteTemplate(template.id);
          await refresh();
        },
      },
    ]);
  }

  const box = { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line };

  if (editing !== null) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel="Template name"
          value={name}
          onChangeText={setName}
          placeholder="Template name"
          placeholderTextColor={colors.inkFaint}
          autoFocus
          style={[box, styles.nameInput, { color: colors.ink, backgroundColor: colors.surface }]}
        />
        <TextInput
          accessibilityLabel="Template content"
          value={content}
          onChangeText={setContent}
          placeholder="Template content — use {{date}}, {{time}} or {{title}}"
          placeholderTextColor={colors.inkFaint}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          style={[box, styles.contentInput, { color: colors.ink, backgroundColor: colors.surface, fontFamily: MONO }]}
        />
        <View style={styles.formButtons}>
          <Button variant="ghost" label="Cancel" onPress={() => setEditing(null)} />
          <Button variant="primary" label="Save" onPress={save} disabled={!name.trim()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <SectionHeading>Your templates</SectionHeading>
      {templates?.length === 0 && <EmptyHint>No templates yet.</EmptyHint>}
      {templates?.map((t) => (
        <View key={t.id} style={[box, styles.row]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${t.name}`} onPress={() => startEditing(t.id)} style={styles.rowMain}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15 }}>
              {t.name}
            </Text>
            {t.isDefaultForDailyNote && <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.accentInk, marginTop: 3 }}>DAILY DEFAULT</Text>}
          </Pressable>
          {!t.isDefaultForDailyNote && (
            <Button
              compact
              variant="ghost"
              label="Use for daily notes"
              accessibilityLabel={`Use ${t.name} for daily notes`}
              onPress={async () => {
                await vault.setDefaultForDailyNote(t.id);
                await refresh();
              }}
            />
          )}
          <IconButton icon="trash" label={`Delete ${t.name}`} onPress={() => confirmDelete(t)} />
        </View>
      ))}
      <Button variant="primary" icon="plus" label="New template" onPress={() => startEditing("new")} style={styles.newButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 8, marginBottom: 8 },
  rowMain: { flex: 1 },
  newButton: { marginTop: 8, alignSelf: "flex-start" },
  nameInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  contentInput: { padding: 12, fontSize: 13, minHeight: 220, marginBottom: 12 },
  formButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
