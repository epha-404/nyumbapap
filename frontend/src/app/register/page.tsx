import Link from "next/link";
import { PortalAuthForm } from "@/components/portal-auth-form";
import { PortalNav } from "@/components/portal-nav";
import styles from "../portal.module.css";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = await searchParams; const requested = typeof query.returnTo === "string" ? query.returnTo : "/dashboard"; const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard"; return <div className={styles.page}><PortalNav/><main className={styles.auth}><span className={styles.eyebrow}>Join the marketplace</span><h1 className={styles.title}>Create your account</h1><p className={styles.muted}>Choose your account type, then verify your email with a one-time code.</p><PortalAuthForm mode="register" initialEmail={typeof query.email === "string" ? query.email : ""} returnTo={returnTo}/><p className={styles.muted}>Already registered? <Link href="/login">Sign in</Link>.</p></main></div>; }
