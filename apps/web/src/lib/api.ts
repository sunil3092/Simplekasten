import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./session";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched when a refresh attempt fails — nothing short of logging in again fixes that. */
export const FORCE_LOGOUT_EVENT = "simplekasten:force-logout";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      })
      .catch(() => {
        clearTokens();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(FORCE_LOGOUT_EVENT));
        }
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
async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return response;

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${newAccessToken}`);
  return fetch(input, { ...init, headers });
}

/**
 * REST API client with automatic token refresh and error handling.
 * All methods throw on error, so wrap in try/catch or handle with .catch()
 */
export const api = {
  // Auth endpoints
  auth: {
    register: async (email: string, password: string, displayName: string) => {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    login: async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    logout: async (refreshToken: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error("Logout failed");
      return res.json();
    },
  },

  // Notes endpoints
  notes: {
    list: async (kbId: string, tag?: string) => {
      const token = getAccessToken();
      const params = new URLSearchParams({ kbId, ...(tag && { tag }) });
      const res = await authFetch(`${API_URL}/api/notes?${params}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    search: async (kbId: string, query: string) => {
      const token = getAccessToken();
      const params = new URLSearchParams({ kbId, query });
      const res = await authFetch(`${API_URL}/api/notes/search?${params}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    getById: async (id: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/notes/${id}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    create: async (data: any) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    update: async (id: string, data: any) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/notes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    delete: async (id: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    getGraph: async (kbId: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/notes/${kbId}/graph`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },
  },

  // Tags endpoints
  tags: {
    list: async (kbId: string) => {
      const token = getAccessToken();
      const params = new URLSearchParams({ kbId });
      const res = await authFetch(`${API_URL}/api/tags?${params}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },
  },

  // Vaults (Knowledge Bases) endpoints
  vaults: {
    list: async () => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/vaults`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    create: async (name: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/vaults`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },
  },

  // Attachments endpoints
  attachments: {
    list: async (noteId: string) => {
      const token = getAccessToken();
      const params = new URLSearchParams({ noteId });
      const res = await authFetch(`${API_URL}/api/attachments?${params}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },

    delete: async (id: string) => {
      const token = getAccessToken();
      const res = await authFetch(`${API_URL}/api/attachments/${id}`, {
        method: "DELETE",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error.message);
      return res.json();
    },
  },

  // Export endpoint (special handling for binary download)
  downloadVaultExport: async (
    kbId: string,
    filename: string,
  ): Promise<void> => {
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
  },
};
