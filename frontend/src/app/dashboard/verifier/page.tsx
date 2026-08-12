import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { ModerationPortal, type ModerationData } from "@/components/moderation-portal";
import { backendFetch } from "@/lib/server-api";
import styles from "../../portal.module.css";

export const dynamic = "force-dynamic";

export default async function VerifierDashboard() {
  const response = await backendFetch("moderation/queue");
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/dashboard");
  if (!response.ok) throw new Error("Could not load the moderation queue");
  const data = await response.json() as ModerationData;
  return <div className={styles.page}><PortalNav signedIn /><main className={styles.main}>
    <span className={styles.eyebrow}>Verification operations</span>
    <h1 className={styles.title}>Moderation portal</h1>
    <p className={styles.muted}>Review professional identity evidence and listing interiors. Every submission and decision creates an immutable audit event.</p>
    <ModerationPortal initialData={data} />
  </main></div>;
}
