import { Link, Stack } from "expo-router";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useThemeColors } from "@/theme";

// useThemeColors needs the provider above it, so the stack lives in its own
// component rather than in the root layout itself.
function ThemedStack() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen
        name="vault/index"
        options={{
          title: "Simplekasten",
          headerRight: () => (
            <Link href="/settings" accessibilityLabel="Settings" style={{ color: colors.ink, fontSize: 20, paddingHorizontal: 8 }}>
              ⚙
            </Link>
          ),
        }}
      />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
      <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}
