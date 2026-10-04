import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, ErrorText } from "@/components/ui";
import { setLastNote } from "@/lib/lastNote";
import { saveFlowPositions } from "@/lib/settings";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

interface VaultSummary {
  notes: number;
  canvases: number;
  templates: number;
}

// Mobile has one fixed vault with no name of its own to type, so the second
// step asks for this word instead of desktop's vault folder name.
const CONFIRM_WORD = "purge";

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Deletes every note, canvas and template. Two confirmations, as on desktop:
// the first shows what will go, the second needs a word typed — there is no
// trash to restore from, so an accidental tap must not be enough.
export function PurgeVault() {
  const { colors, shape } = useTheme();
  const [summary, setSummary] = useState<VaultSummary | null>(null);
  const [step, setStep] = useState<"warn" | "type">("warn");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === CONFIRM_WORD;

  async function open() {
    const [notes, canvases, templates] = await Promise.all([vault.listNotes(), vault.listCanvases(), vault.listTemplates()]);
    setStep("warn");
    setTyped("");
    setError(null);
    setSummary({ notes: notes.length, canvases: canvases.length, templates: templates.length });
  }

  function close() {
    if (!busy) setSummary(null);
  }

  async function purge() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await vault.purgeVault();
      // Both point at notes that no longer exist.
      setLastNote(null);
      await saveFlowPositions(new Map());
      setSummary(null);
    } catch {
      setError("The vault could not be purged. Nothing more was deleted; try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* On its own row, apart from the everyday settings, so it can't be hit by a near miss. */}
      <View style={[styles.row, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.danger }]}>
        <Text style={{ flex: 1, fontSize: 12, color: colors.inkMuted }}>Permanently delete every note, canvas and template in this vault.</Text>
        <Button variant="danger" compact label="Purge vault…" onPress={open} />
      </View>

      <Modal visible={summary !== null} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          {summary && (
            <View
              accessibilityViewIsModal
              accessibilityLabel="Purge vault"
              style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius }]}
            >
              <Text style={[styles.heading, { color: colors.danger }]}>{step === "warn" ? "Purge this vault?" : "Confirm the purge"}</Text>
              {step === "warn" ? (
                <View style={styles.body}>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>This permanently deletes everything in this vault:</Text>
                  <View accessibilityLabel="What will be deleted">
                    <Text style={{ color: colors.ink, fontSize: 14 }}>• {count(summary.notes, "note")}, with their version history and attachments</Text>
                    <Text style={{ color: colors.ink, fontSize: 14 }}>• {count(summary.canvases, "canvas", "canvases")}</Text>
                    <Text style={{ color: colors.ink, fontSize: 14 }}>• {count(summary.templates, "template")}</Text>
                  </View>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Installed themes and your settings are kept.</Text>
                  <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "600" }}>This cannot be undone. There is no trash to restore from.</Text>
                </View>
              ) : (
                <View style={styles.body}>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>
                    Type <Text style={{ color: colors.ink, fontWeight: "600" }}>{CONFIRM_WORD}</Text> to confirm.
                  </Text>
                  <TextInput
                    accessibilityLabel="Confirmation word"
                    value={typed}
                    onChangeText={setTyped}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    style={[styles.input, { color: colors.ink, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius }]}
                  />
                  {error && <ErrorText>{error}</ErrorText>}
                </View>
              )}
              <View style={styles.buttons}>
                <Button variant="ghost" label="Cancel" onPress={close} disabled={busy} />
                {step === "warn" ? (
                  <Button variant="danger" label="Continue" onPress={() => setStep("type")} />
                ) : (
                  <Button variant="danger" label={busy ? "Purging…" : "Purge vault"} onPress={purge} disabled={!matches || busy} />
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  dialog: { padding: 18 },
  heading: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  body: { gap: 8 },
  input: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
});
