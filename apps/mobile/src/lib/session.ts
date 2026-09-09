import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The OS keychain (via expo-secure-store) is the native-app equivalent of
// apps/web's localStorage — same JWT bearer-token design across every
// client (see IMPLEMENTATION_PLAN.md §1 "Multi-client auth"), just backed by
// a different, more secure store per platform. expo-secure-store has no web
// implementation at all (there's no OS keychain in a browser), so the web
// target — which Expo also supports, and which this project uses for its
// own verification since no simulator is available here — falls back to
// localStorage, same as apps/web.
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const ACCESS_TOKEN_KEY = "vaultvista_access_token";
const REFRESH_TOKEN_KEY = "vaultvista_refresh_token";

export function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([setItem(ACCESS_TOKEN_KEY, accessToken), setItem(REFRESH_TOKEN_KEY, refreshToken)]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
}
