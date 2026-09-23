import { Stack } from "expo-router";
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
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
      <Stack.Screen name="review" options={{ title: "Review" }} />
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
