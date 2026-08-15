import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import { apiJson, clearSession, sessionToken } from "@/lib/api";
import type { Session } from "@/lib/types";

const AuthContext = createContext<{ session: Session | null; loading: boolean; refresh: () => Promise<unknown>; signOut: () => Promise<void> }>({ session: null, loading: true, refresh: async () => {}, signOut: async () => {} });

function AuthProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({ queryKey: ["session"], queryFn: async () => (await sessionToken()) ? (await apiJson<{ session: Session }>("auth/session")).session : null, retry: false });
  const value = useMemo(() => ({ session: query.data ?? null, loading: query.isLoading, refresh: query.refetch, signOut: async () => { try { await apiJson("auth/logout", { method: "POST" }); } catch {} await clearSession(); await query.refetch(); } }), [query.data, query.isLoading, query.refetch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
