// Browser localStorage for the web build; Tauri/React Native swap this module
// for OS keychain storage (see IMPLEMENTATION_PLAN.md §1 "Multi-client auth")
// without anything above this file needing to change.
const TOKEN_KEY = "vaultvista_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
