import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/providers/app-provider";
import { InteriorImageUpload } from "@/components/interior-image-upload";
import { ListPropertyCta } from "@/components/list-property-cta";
import { ProfessionalOnboarding } from "@/components/professional-onboarding";
import { Body, Button, Card, Eyebrow, H1, H2, Screen } from "@/components/ui";
import { colors, spacing, typography } from "../../theme";

export default function Dashboard() {
  const auth = useAuth();
  const role = auth.session?.role;
  const endpoint = role === "ADMIN" ? "dashboard/admin" : role === "LANDLORD" || role === "AGENT" ? "dashboard/landlord" : role === "VERIFIER" ? "moderation/queue" : "dashboard/visitor";
  const query = useQuery({ queryKey: ["dashboard", role], queryFn: () => apiJson<any>(endpoint), enabled: Boolean(role) });
  if (auth.loading) return <Screen><Body muted>Loading your workspace…</Body></Screen>;
  if (!auth.session) return <Screen><Eyebrow>Your workspace</Eyebrow><H1>Sign in to continue</H1><Body muted>Use email verification to access saved homes, listings, payments, and moderation tools.</Body><Button title="Sign in" onPress={() => router.push("/login")} /><Button secondary title="Create account" onPress={() => router.push("/register")} /></Screen>;
  if (auth.session.requiresEmailCapture) { router.replace("/account/verify-email"); return null; }
  return <Screen>
    <Eyebrow>{role === "ADMIN" ? "Administration" : role === "LANDLORD" ? "Landlord dashboard" : role === "AGENT" ? "Agent workspace" : role === "VERIFIER" ? "Verification operations" : "Client dashboard"}</Eyebrow>
    <H1>{query.data?.displayName ? `Welcome, ${query.data.displayName}` : role === "VERIFIER" ? "Moderation portal" : "Your NyumbaPap dashboard"}</H1>
    <Body muted>{role === "LANDLORD" || role === "AGENT" ? "Publish vacancies, upload interiors, and review your active portfolio." : role === "VERIFIER" ? "Review professional identity evidence and listing interiors." : "Browse current verified vacancies and manage your activity."}</Body>
    {query.isLoading ? <Body muted>Loading live data…</Body> : query.error ? <Card><Body muted>{query.error instanceof Error ? query.error.message : "Dashboard unavailable"}</Body></Card> : <DashboardBody role={role!} data={query.data} />}
    <Button secondary title="Sign out" onPress={async () => { try { await auth.signOut(); router.replace("/login"); } catch (error) { Alert.alert("Could not sign out", error instanceof Error ? error.message : "Try again."); } }} />
  </Screen>;
}

function DashboardBody({ role, data }: { role: string; data: any }) {
  if (role === "LANDLORD" || role === "AGENT") return <>
    <ListPropertyCta />
    <ProfessionalOnboarding />
    <View style={s.metrics}>{Object.entries(data.stats ?? {}).filter(([, value]) => typeof value === "number").map(([key, value]) => <Card key={key} style={s.metricCard}><Text style={s.metric}>{Number(value).toLocaleString("en-KE")}</Text><Body muted>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</Body></Card>)}</View>
    <H2>Your properties</H2>
    {(data.listings ?? []).map((listing: any) => <Card key={listing.id}><Text style={s.badge}>{listing.status}</Text><H2>{listing.title}</H2><Body muted>{listing.area}, {listing.town}</Body><Text style={s.price}>KSh {listing.monthlyRentKes.toLocaleString("en-KE")}</Text><InteriorImageUpload listingId={listing.id} /></Card>)}
    {!data.listings?.length ? <Card><Body muted>No listings yet. Create one, then upload its interior photos here.</Body></Card> : null}
  </>;
  if (role === "VERIFIER") return <><Metric label="pending listings" value={data.listings?.length ?? 0} /><Metric label="pending identities" value={data.identities?.length ?? 0} /><Metric label="pending interior photos" value={data.photos?.length ?? 0} />{[...(data.listings ?? []), ...(data.identities ?? []), ...(data.photos ?? [])].map((item: any) => <Card key={item.id}><H2>{item.title ?? item.subjectName ?? item.listingTitle}</H2><Body muted>Awaiting review</Body></Card>)}</>;
  const stats = data.stats ?? {};
  return <View style={s.metrics}>{Object.entries(stats).map(([key, value]) => <Metric key={key} label={key.replace(/([A-Z])/g, " $1").toLowerCase()} value={typeof value === "number" ? value : 0} />)}</View>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card style={s.metricCard}><Text style={s.metric}>{value.toLocaleString("en-KE")}</Text><Body muted>{label}</Body></Card>; }
const s = StyleSheet.create({ metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, metricCard: { minWidth: "45%", flexGrow: 1 }, metric: { color: colors.green, fontFamily: typography.heading, fontSize: 34 }, badge: { alignSelf: "flex-start", color: colors.green, backgroundColor: colors.paleGreen, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontFamily: typography.bodyBold, fontSize: 12 }, price: { color: colors.green, fontFamily: typography.heading, fontSize: 22 } });
