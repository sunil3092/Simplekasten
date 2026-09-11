import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { setTokens } from "@/lib/session";
import { trpc } from "@/lib/trpc";
import { useThemeColors } from "@/theme";

export default function RegisterScreen() {
  const colors = useThemeColors();
  const { setAuthed } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const result = await trpc.auth.register.mutate({ displayName, email, password });
      await setTokens(result.accessToken, result.refreshToken);
      setAuthed(true);
    } catch {
      setError("Could not create an account with that email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Simplekasten</Text>
      <Text style={[styles.subtitle, { color: colors.inkMuted }]}>A slip-box for ideas that link back.</Text>

      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.inkFaint}
        secureTextEntry
        autoComplete="new-password"
        style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={loading || !displayName || !email || !password}
        style={[
          styles.button,
          { backgroundColor: colors.accent, opacity: loading || !displayName || !email || !password ? 0.6 : 1 },
        ]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
      </Pressable>

      <Link href="/login" style={[styles.link, { color: colors.inkFaint }]}>
        Already have an account? Log in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 15, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", fontSize: 13 },
  link: { textAlign: "center", marginTop: 16, textDecorationLine: "underline" },
});
