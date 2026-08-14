import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { EmailMigrationForm } from "@/components/email-migration-form";
import { backendFetch } from "@/lib/server-api";
import styles from "@/app/portal.module.css";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage() {
  const response = await backendFetch("auth/session");
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error("Could not load the current session");
  const body = await response.json() as { session: { requiresEmailCapture?: boolean } };
  if (!body.session.requiresEmailCapture) redirect("/dashboard");
  return <div className={styles.page}><PortalNav signedIn /><main className={styles.auth}><span className={styles.eyebrow}>Account update</span><h1 className={styles.title}>Verify your email</h1><p className={styles.muted}>Your account was created before email sign-in. Add and verify an email address before continuing.</p><EmailMigrationForm /></main></div>;
}
