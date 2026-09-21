import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useThemeColors } from "@/theme";

const TAB_ICONS: Record<string, string> = {
  index: "📝",
  graph: "🕸",
  settings: "⚙",
};

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accentInk,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Simplekasten", tabBarLabel: "Vault" }} />
      <Tabs.Screen name="graph" options={{ title: "Graph", tabBarLabel: "Graph" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarLabel: "Settings" }} />
    </Tabs>
  );
}
