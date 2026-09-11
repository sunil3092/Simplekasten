import { createTRPCClient, httpBatchLink, httpLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@simplekasten/api";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./session";

// Same API, same client shape as apps/web (see that file's comment) — only
// the token storage backing it differs. On a physical device or emulator
// "localhost" means the device itself, not this machine: the Android
// emulator needs 10.0.2.2, and a real device needs your machine's LAN IP.
// expo start --web (used for this project's own verification, no
// simulator available) runs in a real browser, where localhost is correct.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

type ForceLogoutListener = () => void;
const forceLogoutListeners = new Set<ForceLogoutListener>();

/** React Native has no `window` CustomEvent bus, so this is apps/web's FORCE_LOGOUT_EVENT as a tiny pub-sub. */
export function onForceLogout(listener: ForceLogoutListener): () => void {
  forceLogoutListeners.add(listener);
  return () => forceLogoutListeners.delete(listener);
}

function emitForceLogout() {
  forceLogoutListeners.forEach((listener) => listener());
}

const refreshClient = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${API_URL}/trpc` })],
});

let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = getRefreshToken()
      .then((refreshToken) => {
        if (!refreshToken) return null;
        return refreshClient.auth.refresh.mutate({ refreshToken }).then((result) => {
          setTokens(result.accessToken, result.refreshToken);
          return result.accessToken;
        });
      })
      .catch(async () => {
        await clearTokens();
        emitForceLogout();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return response;

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${newAccessToken}`);
  return fetch(input, { ...init, headers });
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch: authFetch,
      async headers() {
        const token = await getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export { TRPCClientError };
