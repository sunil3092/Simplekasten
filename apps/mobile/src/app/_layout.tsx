import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/theme";

function RootLayoutNav() {
  const { authed } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useThemeColors();

  // The standard expo-router auth-guard pattern: redirect based on whether
  // the current route is in the unauthenticated group, re-evaluated any
  // time auth state or the route itself changes.
  useEffect(() => {
    if (authed === null) return;
    const inAuthGroup = segments[0] === "login" || segments[0] === "register";
    if (!authed && !inAuthGroup) router.replace("/login");
    else if (authed && inAuthGroup) router.replace("/vault");
  }, [authed, segments, router]);

  if (authed === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Log in", headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Create account", headerShown: false }} />
      <Stack.Screen name="vault/index" options={{ title: "VaultVista" }} />
      <Stack.Screen name="vault/[id]" options={{ title: "" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
