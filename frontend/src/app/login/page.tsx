import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAuthForm } from "@/components/portal-auth-form";
import { PortalNav } from "@/components/portal-nav";
import styles from "../portal.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = await searchParams; if (query.email || query.password) redirect("/login"); const requested = typeof query.returnTo === "string" ? query.returnTo : "/dashboard"; const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard"; return <div className={styles.page}><PortalNav/><main className={styles.auth}><span className={styles.eyebrow}>Welcome back</span><h1 className={styles.title}>Sign in to NyumbaPap</h1><p className={styles.muted}>Enter your email address and we will send a one-time verification code. New emails become home-seeker accounts after verification.</p><PortalAuthForm mode="login" returnTo={returnTo}/><p className={styles.muted}>Want a landlord or agent account? <Link href="/register">Choose an account type</Link>.</p></main></div>; }
