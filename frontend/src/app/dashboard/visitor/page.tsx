import { redirect } from "next/navigation";
import Link from "next/link";
import { PortalNav } from "@/components/portal-nav";
import { backendFetch } from "@/lib/server-api";
import styles from "../../portal.module.css";

type ClientDashboardData = {
  displayName: string;
  stats: { listings: number; unlocks: number; enquiries: number; viewings: number };
  listings: Array<{ id: string; title: string; area: string; town: string; unitType: string; bathrooms: number; sizeSquareMetres: number | null; monthlyRentKes: number; imageUrl: string | null; landlordBadge?: { label: string; state: "verified" | "unverified" } | null }>;
};

export const dynamic = "force-dynamic";

export default async function ClientDashboard() {
  const response = await backendFetch("dashboard/visitor");
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/dashboard");
  if (!response.ok) throw new Error("Could not load the client dashboard");
  const data = await response.json() as ClientDashboardData;
  return <div className={styles.page}><PortalNav signedIn /><main className={styles.main}>
    <span className={styles.eyebrow}>Client dashboard</span>
    <h1 className={styles.title}>Find your next home, {data.displayName}</h1>
    <p className={styles.muted}>Browse current verified vacancies. Exact addresses remain private until contact is unlocked.</p>
    <section className={styles.grid}>
      <div className={styles.card}><div className={styles.metric}>{data.stats.listings}</div><span>available homes</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.unlocks}</div><span>contact unlocks</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.enquiries}</div><span>enquiries sent</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.viewings}</div><span>viewings requested</span></div>
    </section>
    <h2>Available homes</h2>
    <section className={styles.grid}>{data.listings.map((listing) => <article className={`${styles.card} ${styles.listing}`} key={listing.id}>{listing.imageUrl && <img src={listing.imageUrl} alt={`Interior of ${listing.title}`} loading="lazy" style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 12 }} />}{listing.landlordBadge && <span className={`landlord-verification ${listing.landlordBadge.state}`}>{listing.landlordBadge.label}</span>}<h3>{listing.title}</h3><span>{listing.area}, {listing.town}</span><span>{listing.unitType} - {listing.bathrooms} bath - {listing.sizeSquareMetres ?? "unknown"} square metres</span><span className={styles.price}>KSh {listing.monthlyRentKes.toLocaleString("en-KE")} <small>/ month</small></span><Link className={styles.secondary} href={`/listings/${listing.id}`}>View details</Link></article>)}</section>
    {!data.listings.length && <div className={styles.card}><h2>No published homes yet</h2></div>}
  </main></div>;
}
