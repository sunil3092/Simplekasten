import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";

// _layout.tsx already withholds the whole <Stack> (this route included)
// until `authed` resolves, so by the time this renders it's never null —
// deciding the destination here, rather than always pointing at /vault and
// leaving _layout.tsx's effect to redirect away a tick later, is what stops
// an unauthenticated visitor from mounting (and firing data-fetch effects
// in) the vault screen at all, even momentarily.
export default function Index() {
  const { authed } = useAuth();
  return <Redirect href={authed ? "/vault" : "/login"} />;
}
