import { applyTypingSuggestion, COPY, matchingSuggestions, typingSuggestion } from "@simplekasten/core";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import { Chip } from "@/components/ui";
import { useTheme } from "@/theme";

interface NoteTextInputProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Titles of the other notes, offered after `[[`. */
  titles: string[];
  /** The vault's tags, offered after `#`. */
  tags: string[];
  /** One scrolling row of small chips rather than a wrapping block — for a card with little room. */
  compact?: boolean;
  style?: StyleProp<TextStyle>;
  editable?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

// A note's body field. Offers note titles while a `[[link` is being typed
// and existing tags while a `#tag` is — what desktop's editor does with its
// suggestion list, as tappable chips under the text.
export function NoteTextInput({ value, onChangeText, titles, tags, compact, style, editable, onFocus, onBlur }: NoteTextInputProps) {
  const { colors, shape } = useTheme();
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  // Only set right after a suggestion is applied, to move the cursor past the
  // inserted text; otherwise the input owns its cursor (a fully controlled
  // selection makes Android's cursor jump while typing).
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  // Tapping a suggestion can take focus from the field a moment before the
  // tap itself arrives; the chips stay up just long enough to receive it.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (blurTimer.current && clearTimeout(blurTimer.current)), []);

  const open = focused && selection.start === selection.end ? typingSuggestion(value, selection.start) : null;
  const suggestions = open ? matchingSuggestions(open, titles, tags) : [];

  function apply(suggestion: string) {
    if (!open) return;
    const next = applyTypingSuggestion(value, selection.start, open, suggestion);
    setSelection({ start: next.cursor, end: next.cursor });
    setForcedSelection({ start: next.cursor, end: next.cursor });
    onChangeText(next.text);
  }

  const label = open?.kind === "tag" ? "Tag suggestions" : "Link suggestions";
  const prefix = open?.kind === "tag" ? "#" : "";

  return (
    <>
      <TextInput
        accessibilityLabel="Note text"
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        selection={forcedSelection}
        onSelectionChange={(e) => {
          setSelection(e.nativeEvent.selection);
          setForcedSelection(undefined);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setFocused(false), 250);
          onBlur?.();
        }}
        placeholder={COPY.editorPlaceholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        textAlignVertical="top"
        style={style}
      />
      {suggestions.length > 0 &&
        (compact ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            accessibilityLabel={label}
            style={styles.compactRow}
            contentContainerStyle={styles.compactContent}
          >
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`${prefix}${s}`}
                onPress={() => apply(s)}
                style={[styles.compactChip, { borderWidth: shape.borderWidth, borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
              >
                <Text numberOfLines={1} style={{ fontSize: 10, color: colors.accentInk, maxWidth: 120 }}>
                  {prefix}
                  {s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.row} accessibilityLabel={label}>
            {suggestions.map((s) => (
              <Chip key={s} label={`${prefix}${s}`} onPress={() => apply(s)} />
            ))}
          </View>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  compactRow: { flexGrow: 0, maxHeight: 26 },
  compactContent: { flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingBottom: 6 },
  compactChip: { justifyContent: "center", paddingHorizontal: 7, height: 20, borderRadius: 10 },
});
