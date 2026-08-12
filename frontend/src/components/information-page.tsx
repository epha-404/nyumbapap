import Link from "next/link";
import { PortalNav } from "@/components/portal-nav";
import styles from "@/app/information.module.css";

export function InformationPage({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <div className={styles.page}><PortalNav /><main className={styles.main}><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p className={styles.updated}>Last updated 12 August 2026</p>{children}</main><footer className={styles.footer}><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help and safety</Link><Link href="/">Marketplace</Link></footer></div>;
}
