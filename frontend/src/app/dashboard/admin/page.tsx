import { redirect } from "next/navigation";
import Link from "next/link";
import { PortalNav } from "@/components/portal-nav";
import { UnlockFeeConfigForm, type UnlockFeeConfig } from "@/components/unlock-fee-config-form";
import { ModerationPortal, type ModerationData } from "@/components/moderation-portal";
import { backendFetch } from "@/lib/server-api";
import styles from "../../portal.module.css";

type AdminDashboardData = {
  displayName: string;
  stats: { users: number; landlords: number; clients: number; properties: number; listings: number; revenue: number };
  users: Array<{ id: string; role: string; status: string; createdAt: string; displayName: string | null }>;
  listings: Array<{ id: string; title: string; status: string; area: string; town: string; monthlyRentKes: number }>;
};

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [response, feeResponse, moderationResponse] = await Promise.all([
    backendFetch("dashboard/admin"),
    backendFetch("admin/unlock-fee"),
    backendFetch("moderation/queue")
  ]);
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/dashboard");
  if (!response.ok) throw new Error("Could not load the admin dashboard");
  const data = await response.json() as AdminDashboardData;
  const config = feeResponse.ok ? ((await feeResponse.json() as { config: UnlockFeeConfig }).config) : null;
  const moderation = moderationResponse.ok ? await moderationResponse.json() as ModerationData : null;
  return <div className={styles.page}><PortalNav signedIn /><main className={styles.main}>
    <span className={styles.eyebrow}>Administration</span>
    <h1 className={styles.title}>Marketplace overview</h1>
    <p className={styles.muted}>Signed in as {data.displayName}. Review users, roles and published inventory.</p>
    <div className={styles.actions}><Link className={styles.primary} href="#verification-queue">Review pending verification</Link></div>
    <section className={styles.grid}>
      <div className={styles.card}><div className={styles.metric}>{data.stats.users}</div><span>all users</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.landlords}</div><span>landlords</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.clients}</div><span>clients</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.properties}</div><span>properties</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.listings}</div><span>listings</span></div>
      <div className={styles.card}><div className={styles.metric}>KSh {data.stats.revenue.toLocaleString("en-KE")}</div><span>paid revenue</span></div>
    </section>
    <section id="verification-queue">
      <h2>Verification queue</h2>
      <p className={styles.muted}>Review landlord identity evidence and listing interiors without leaving the administration dashboard.</p>
      {moderation ? <ModerationPortal initialData={moderation} /> : <p className={styles.error} role="alert">The verification queue could not be loaded. Refresh to try again.</p>}
    </section>
    <h2>Accounts</h2>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>
      {data.users.map((user) => <tr key={user.id}><td>{user.displayName ?? "Unnamed account"}</td><td><span className={styles.badge}>{user.role}</span></td><td>{user.status}</td><td>{new Date(user.createdAt).toLocaleDateString("en-KE")}</td></tr>)}
    </tbody></table></div>
    <h2>Listings</h2>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Listing</th><th>Location</th><th>Rent</th><th>Status</th></tr></thead><tbody>
      {data.listings.map((listing) => <tr key={listing.id}><td>{listing.title}</td><td>{listing.area}, {listing.town}</td><td>KSh {listing.monthlyRentKes.toLocaleString("en-KE")}</td><td>{listing.status}</td></tr>)}
    </tbody></table></div>
    {config ? <UnlockFeeConfigForm initialConfig={config} /> : <section className={styles.card}><h2>Payment configuration unavailable</h2><p className={styles.muted}>The rest of the administration dashboard remains available. Refresh to retry this panel.</p></section>}
  </main></div>;
}
