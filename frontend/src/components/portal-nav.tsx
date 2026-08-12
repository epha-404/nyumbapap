"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export function PortalNav({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  async function logout() { await csrfFetch("auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  return <nav className={styles.nav}><Link className={styles.brand} href="/">Nyumba<span>Pap</span></Link><div className={styles.links}><Link href="/">Marketplace</Link>{signedIn ? <><Link href="/dashboard">Dashboard</Link><button className={styles.secondary} onClick={logout}>Sign out</button></> : <><Link href="/login">Sign in</Link><Link href="/register">Register</Link></>}</div></nav>;
}
