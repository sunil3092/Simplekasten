import { Stack } from "expo-router";
import { useThemeColors } from "@/theme";

export default function RootLayout() {
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
      <Stack.Screen name="vault/index" options={{ title: "Simplekasten" }} />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
    </Stack>
  );
}
