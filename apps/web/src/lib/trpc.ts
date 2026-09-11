import { createTRPCClient, httpBatchLink, httpLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@simplekasten/api";
import { isLocalMode, localDownloadVaultExport, localTrpc } from "./localVaultClient";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./session";

// Same client shape for every platform: web reads this from an env var baked
// in at build time, Electron and React Native will point it at the same
// deployed API — none of them ever talk to a database directly.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched when a refresh attempt fails — nothing short of logging in again fixes that. */
export const FORCE_LOGOUT_EVENT = "simplekasten:force-logout";

// A plain client with no retry wrapper, used only for the refresh call itself
// — routing it through the main client would recurse into this same logic.
const refreshClient = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${API_URL}/trpc` })],
});

let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  if (!refreshPromise) {
    refreshPromise = refreshClient.auth.refresh
      .mutate({ refreshToken })
      .then((result) => {
        setTokens(result.accessToken, result.refreshToken);
        return result.accessToken;
      })
      .catch(() => {
        clearTokens();
        window.dispatchEvent(new Event(FORCE_LOGOUT_EVENT));
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// A 15-minute access token expiring mid-session shouldn't be visible to the
// rest of the app: catch the 401 here, refresh once, and retry transparently.
async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return response;

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${newAccessToken}`);
  return fetch(input, { ...init, headers });
}

// The export endpoint streams a zip, which doesn't fit tRPC's JSON request/
// response shape, so it's a plain authenticated fetch (still routed through
// authFetch for the same transparent 401-refresh-and-retry as every tRPC call).
async function remoteDownloadVaultExport(kbId: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const response = await authFetch(`${API_URL}/export/${kbId}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Export failed");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const downloadVaultExport: (kbId: string, filename: string) => Promise<void> = isLocalMode()
  ? localDownloadVaultExport
  : remoteDownloadVaultExport;

const remoteTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch: authFetch,
      headers() {
        const token = getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

// Running inside the Electron desktop shell (window.simplekasten present, see
// apps/desktop/preload.js) swaps every call in this module for a local
// filesystem operation instead of a network request — no API, no login. See
// apps/web/src/lib/localVaultClient.ts.
export const trpc: typeof remoteTrpc = isLocalMode() ? localTrpc : remoteTrpc;

export { TRPCClientError };
