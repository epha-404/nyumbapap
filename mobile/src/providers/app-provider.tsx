import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { apiJson, clearSession, sessionToken } from "@/lib/api";
import type { Session } from "@/lib/types";
import { initialListingSearchPreferences, type ListingSearchPreferences } from "@/lib/listing-search";

const AuthContext = createContext<{ session: Session | null; loading: boolean; refresh: () => Promise<unknown>; signOut: () => Promise<void> }>({ session: null, loading: true, refresh: async () => {}, signOut: async () => {} });
const ListingSearchContext = createContext<{ preferences: ListingSearchPreferences; setPreferences: Dispatch<SetStateAction<ListingSearchPreferences>> } | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({ queryKey: ["session"], queryFn: async () => (await sessionToken()) ? (await apiJson<{ session: Session }>("auth/session")).session : null, retry: false });
  const value = useMemo(() => ({ session: query.data ?? null, loading: query.isLoading, refresh: query.refetch, signOut: async () => { try { await apiJson("auth/logout", { method: "POST" }); } catch {} await clearSession(); await query.refetch(); } }), [query.data, query.isLoading, query.refetch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
export function useListingSearch() {
  const value = useContext(ListingSearchContext);
  if (!value) throw new Error("useListingSearch must be used inside AppProvider");
  return value;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [preferences, setPreferences] = useState(initialListingSearchPreferences);
  const search = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  return <QueryClientProvider client={client}><AuthProvider><ListingSearchContext.Provider value={search}>{children}</ListingSearchContext.Provider></AuthProvider></QueryClientProvider>;
}
