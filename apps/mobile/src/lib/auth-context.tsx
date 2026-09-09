import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearTokens, getAccessToken } from "./session";
import { onForceLogout } from "./trpc";

interface AuthContextValue {
  // null = still checking SecureStore on first launch
  authed: boolean | null;
  setAuthed: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getAccessToken().then((token) => setAuthed(Boolean(token)));
  }, []);

  // Mirrors apps/web's FORCE_LOGOUT_EVENT listener: a refresh attempt that
  // fails outright means no token is going to work, so drop back to login.
  useEffect(() => onForceLogout(() => setAuthed(false)), []);

  async function logout() {
    await clearTokens();
    setAuthed(false);
  }

  return <AuthContext.Provider value={{ authed, setAuthed, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
