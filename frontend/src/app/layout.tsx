import type { Metadata, Viewport } from "next";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "NyumbaPap - Find a home in Kenya",
  description: "Discover verified rental homes across Kenya.",
  manifest: "/manifest.webmanifest",
  applicationName: "NyumbaPap",
  appleWebApp: { capable: true, title: "NyumbaPap", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }], apple: "/icons/apple-touch-icon.png" }
};
export const viewport: Viewport = { themeColor: "#075b49", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a><div id="main-content" tabIndex={-1}>{children}</div><AnalyticsConsent /><PwaRegister /></body></html>;
}
