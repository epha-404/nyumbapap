import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { ListingManager } from "@/components/listing-manager";
import { ProfessionalOnboardingForm, type OnboardingData } from "@/components/professional-onboarding-form";
import { backendFetch } from "@/lib/server-api";
import styles from "../../portal.module.css";

type DashboardData = {
  displayName: string;
  role: "LANDLORD" | "AGENT" | "ADMIN";
  canViewFinancials: boolean;
  stats: { listings: number; activeListings: number; enquiries: number; views: number; unlocks: number; acceptedViewings: number; revenue: number | null };
  listings: Array<{ id: string; title: string; status: string; area: string; town: string; monthlyRentKes: number }>;
};

export const dynamic = "force-dynamic";

export default async function LandlordDashboard() {
  const [response, onboardingResponse] = await Promise.all([
    backendFetch("dashboard/landlord"),
    backendFetch("onboarding")
  ]);
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/dashboard");
  if (!response.ok || !onboardingResponse.ok) throw new Error("Could not load the listing dashboard");
  const data = await response.json() as DashboardData;
  const { onboarding } = await onboardingResponse.json() as { onboarding: OnboardingData };
  return <div className={styles.page}><PortalNav signedIn /><main className={styles.main}>
    <div className={styles.header}><div>
      <span className={styles.eyebrow}>{data.role === "AGENT" ? "Agent workspace" : "Landlord dashboard"}</span>
      <h1 className={styles.title}>Welcome, {data.displayName}</h1>
      <p className={styles.muted}>Publish vacancies and review your active portfolio.</p>
    </div><div className={styles.card}><div className={styles.metric}>{data.stats.listings}</div><span>total listings</span></div></div>
    <section className={styles.grid}>
      <div className={styles.card}><div className={styles.metric}>{data.stats.activeListings}</div><span>active listings</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.enquiries}</div><span>client enquiries</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.views}</div><span>unique daily listing views</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.unlocks}</div><span>paid contact unlocks</span></div>
      <div className={styles.card}><div className={styles.metric}>{data.stats.acceptedViewings}</div><span>accepted viewing requests</span></div>
      {data.canViewFinancials && <div className={styles.card}><div className={styles.metric}>KSh {(data.stats.revenue ?? 0).toLocaleString("en-KE")}</div><span>listing revenue</span></div>}
    </section>
    <div style={{ marginTop: 30 }}><ProfessionalOnboardingForm onboarding={onboarding} /></div>
    <ListingManager
      initialListings={data.listings}
      canCreate={onboarding.verificationState === "PENDING" || onboarding.verificationState === "APPROVED"}
    />
  </main></div>;
}
