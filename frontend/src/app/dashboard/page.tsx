import { redirect } from "next/navigation";
import type { AppRole } from "@nyumbapap/contracts";
import { backendFetch } from "@/lib/server-api";

type SessionResponse = { session: { role: AppRole } };

export const dynamic = "force-dynamic";

export default async function DashboardRouter() {
  const response = await backendFetch("auth/session");
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error("Could not load the current session");
  const { session } = await response.json() as SessionResponse;
  if (session.role === "ADMIN") redirect("/dashboard/admin");
  if (session.role === "VERIFIER") redirect("/dashboard/verifier");
  if (session.role === "LANDLORD" || session.role === "AGENT") redirect("/dashboard/landlord");
  if (session.role === "CLIENT") redirect("/dashboard/visitor");
  redirect("/");
}
