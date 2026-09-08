import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@vaultvista/api";
import { getAccessToken } from "./session";

// Same client shape for every platform: web reads this from an env var baked
// in at build time, Tauri and React Native will point it at the same deployed
// API — none of them ever talk to a database directly.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers() {
        const token = getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export { TRPCClientError };
