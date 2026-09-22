import type { IconName } from "@simplekasten/core";
import { Tabs } from "expo-router";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/theme";

// Same glyphs as desktop's sidebar: notes, graph view, settings.
const TAB_ICONS: Record<string, IconName> = {
  index: "fileText",
  graph: "network",
  settings: "settings",
};

export default function TabsLayout() {
  const { colors, shape } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: shape.borderWidth },
        tabBarActiveTintColor: colors.accentInk,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} size={22} color={String(color)} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Simplekasten", tabBarLabel: "Vault" }} />
      <Tabs.Screen name="graph" options={{ title: "Graph", tabBarLabel: "Graph" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarLabel: "Settings" }} />
    </Tabs>
  );
}
