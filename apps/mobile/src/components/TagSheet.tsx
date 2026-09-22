import { COPY, tagPickerState, toggleAssignedTag } from "@simplekasten/core";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { fontFamily, SectionHeading } from "@/components/ui";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");

interface TagSheetProps {
  visible: boolean;
  vaultTags: { name: string; noteCount: number }[];
  /** The note's assigned (frontmatter) tags. */
  assigned: string[];
  /** Every tag on the note, including #hashtags from its text. */
  onNote: string[];
  onChange: (assigned: string[]) => void;
  onClose: () => void;
}

/**
 * Mobile's counterpart to desktop's TagPicker dropdown: the same list, locks
 * and "Create" row (both read @simplekasten/core's tagPickerState), in a
 * bottom sheet instead of a popover.
 */
export function TagSheet({ visible, vaultTags, assigned, onNote, onChange, onClose }: TagSheetProps) {
  const { colors, shape } = useTheme();
  const [query, setQuery] = useState("");
  const state = useMemo(() => tagPickerState({ vaultTags, assigned, onNote, query }), [vaultTags, assigned, onNote, query]);

  function close() {
    setQuery("");
    onClose();
  }

  function create(name: string) {
    onChange(toggleAssignedTag(assigned, name));
    setQuery("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={[styles.fill, { backgroundColor: "rgba(0,0,0,0.4)" }]} onPress={close} accessibilityLabel="Close tags" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderTopWidth: shape.borderWidth,
              borderTopLeftRadius: shape.radius * 1.5,
              borderTopRightRadius: shape.radius * 1.5,
            },
          ]}
        >
          <View style={styles.header}>
            <SectionHeading icon="hash">{COPY.tags}</SectionHeading>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} onPress={close} style={styles.done}>
              <Text style={{ color: colors.accentInk, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>

          <View style={[styles.search, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.bg }]}>
            <Icon name="search" size={16} color={colors.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={COPY.tagSearchPlaceholder}
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => state.create && create(state.create)}
              accessibilityLabel={COPY.tagSearchPlaceholder}
              style={[styles.searchInput, { color: colors.ink }]}
            />
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {state.rows.map((row) => (
              <Pressable
                key={row.name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.checked, disabled: row.locked }}
                accessibilityLabel={`#${row.name}`}
                accessibilityHint={row.locked ? COPY.tagFromTextHint : undefined}
                disabled={row.locked}
                onPress={() => onChange(toggleAssignedTag(assigned, row.name))}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.accentSoft : "transparent" }]}
              >
                <View
                  style={[
                    styles.box,
                    {
                      borderWidth: shape.borderWidth,
                      borderRadius: Math.min(shape.radius, 4),
                      borderColor: row.checked ? colors.accent : colors.line,
                      backgroundColor: row.checked ? colors.accent : "transparent",
                      opacity: row.locked ? 0.5 : 1,
                    },
                  ]}
                >
                  {row.checked && <Icon name="check" size={12} color="#ffffff" />}
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 14, color: colors.ink }}>
                  #{row.name}
                </Text>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint }}>{row.locked ? COPY.tagFromText : row.noteCount}</Text>
              </Pressable>
            ))}

            {state.create && (
              <Pressable accessibilityRole="button" onPress={() => create(state.create!)} style={styles.row}>
                <Icon name="plus" color={colors.accent2} />
                <Text style={{ color: colors.accent2, fontSize: 15 }}>{COPY.createTag(state.create)}</Text>
              </Pressable>
            )}
            {state.invalid && <Text style={[styles.hint, { color: colors.danger }]}>{COPY.invalidTag}</Text>}
            {!query.trim() && state.rows.length === 0 && <Text style={[styles.hint, { color: colors.inkFaint }]}>{COPY.noTagsYet}</Text>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, maxHeight: "70%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  // SectionHeading carries its own bottom margin; match it so "Done" centres on the label.
  done: { marginBottom: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 9 },
  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  box: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 13, paddingVertical: 12, paddingHorizontal: 4 },
});
