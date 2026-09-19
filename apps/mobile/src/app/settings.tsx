import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ModePreference } from "@simplekasten/themes";
import { HardShadow } from "@/components/HardShadow";
import { useTheme } from "@/components/ThemeProvider";

const BUILT_IN_IDS = ["default", "memphis"];
const MODES: { value: ModePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const { themes, activeId, mode, notice, colors, shape, setTheme, setMode, install, installFromFile, remove } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFile() {
    const outcome = await installFromFile();
    if (outcome.ok) setErrors([]);
    else if (!("canceled" in outcome && outcome.canceled)) setErrors(outcome.errors);
  }

  async function handlePaste() {
    const outcome = await install(json);
    if (outcome.ok) {
      setErrors([]);
      setJson("");
      setPasting(false);
    } else {
      setErrors(outcome.errors);
    }
  }

  const box = { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line };
  const heading = { color: colors.inkFaint, fontSize: 12, letterSpacing: 1, marginBottom: 8, marginTop: 20 } as const;

  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={{ padding: 16 }}>
      {notice && (
        <Text style={{ color: colors.accent2, backgroundColor: colors.accent2Soft, padding: 10, borderRadius: shape.radius }}>{notice}</Text>
      )}

      <Text style={heading}>THEME</Text>
      {themes.map((theme) => {
        const selected = activeId === theme.id;
        const builtIn = BUILT_IN_IDS.includes(theme.id);
        return (
          <View key={theme.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <HardShadow>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTheme(theme.id)}
                  style={[
                    box,
                    {
                      padding: 12,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.line,
                    },
                  ]}
                >
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {selected ? "● " : "○ "}
                    {theme.name}
                  </Text>
                  <Text style={{ color: colors.inkFaint, fontSize: 11 }}>{builtIn ? "built-in" : (theme.author ?? "installed")}</Text>
                </Pressable>
              </HardShadow>
            </View>
            {!builtIn && (
              <Pressable
                accessibilityLabel={`Remove ${theme.name}`}
                onPress={() =>
                  Alert.alert("Remove theme?", theme.name, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => remove(theme.id) },
                  ])
                }
              >
                <Text style={{ color: colors.inkMuted }}>Remove</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Text style={heading}>APPEARANCE</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            accessibilityRole="button"
            onPress={() => setMode(m.value)}
            style={[
              box,
              {
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: mode === m.value ? colors.accentSoft : colors.surface,
                borderColor: mode === m.value ? colors.accent : colors.line,
              },
            ]}
          >
            <Text style={{ color: mode === m.value ? colors.accentInk : colors.inkMuted }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={heading}>INSTALL A THEME</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={handleFile} style={[box, { padding: 10, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.ink }}>Install theme…</Text>
        </Pressable>
        <Pressable onPress={() => setPasting((p) => !p)} style={{ padding: 10 }}>
          <Text style={{ color: colors.inkMuted }}>Paste JSON</Text>
        </Pressable>
      </View>

      {pasting && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <TextInput
            accessibilityLabel="Theme JSON"
            value={json}
            onChangeText={setJson}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[box, { minHeight: 140, padding: 8, color: colors.ink, fontFamily: "Courier", fontSize: 12, textAlignVertical: "top" }]}
          />
          <Pressable
            onPress={handlePaste}
            style={[box, { padding: 10, backgroundColor: colors.accentSoft, borderColor: colors.accent, alignSelf: "flex-start" }]}
          >
            <Text style={{ color: colors.accentInk, fontWeight: "600" }}>Install</Text>
          </Pressable>
        </View>
      )}

      {errors.length > 0 && (
        <View style={{ marginTop: 12, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: shape.radius }} accessibilityRole="alert">
          {errors.map((e) => (
            <Text key={e} style={{ color: colors.danger }}>
              • {e}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
