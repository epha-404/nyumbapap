import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/server-api";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const response = await backendFetch("auth/session");
  if (response.status === 401) redirect("/login");
  if (response.ok) {
    const body = await response.json() as { session?: { requiresEmailCapture?: boolean } };
    if (body.session?.requiresEmailCapture) redirect("/account/verify-email");
  }
  return children;
}
