import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import * as Location from "expo-location";
import { Picker } from "@react-native-picker/picker";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { apiJson } from "@/lib/api";
import { listingSearchPath, normalizedBudgetRange, townFromGeocode } from "@/lib/listing-search";
import type { ListingCard as Listing } from "@/lib/types";
import { ListingCard } from "@/components/listing-card";
import { Body, Button, Eyebrow, H2, Screen } from "@/components/ui";
import { useListingSearch } from "@/providers/app-provider";
import { colors, radii, spacing, typography } from "../../theme";

type Stats = { vacantHomes: number; townsCovered: number; verifiedLandlordPercent: number | null; successfulUnlocks: number };
type ListingsPayload = { data: Listing[]; towns: string[]; stats: Stats };
const budgetOptions = [10_000, 15_000, 25_000, 40_000, 70_000, 100_000];

export default function Marketplace() {
  const { preferences, setPreferences } = useListingSearch();
  const [type, setType] = useState("all");
  const [detectedTown, setDetectedTown] = useState<string | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  const path = listingSearchPath(preferences, detectedTown);
  const query = useQuery({ queryKey: ["listings", path], queryFn: () => apiJson<ListingsPayload>(path) });
  const filtered = useMemo(() => (query.data?.data ?? []).filter(item => type === "all" || item.unit.unitType === type), [query.data, type]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const places = await Location.reverseGeocodeAsync(position.coords);
        if (active) setDetectedTown(townFromGeocode(places[0] ?? {}));
      } catch {
        // Location is an optional ranking hint. Search remains usable without it.
      } finally {
        if (active) setLocationSettled(true);
      }
    })();
    return () => { active = false; };
  }, []);

  function setMinimum(value: number | null) {
    setPreferences(current => normalizedBudgetRange({ ...current, minRent: value }, "min"));
  }

  function setMaximum(value: number | null) {
    setPreferences(current => normalizedBudgetRange({ ...current, maxRent: value }, "max"));
  }

  return <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
    <ImageBackground source={{ uri: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85" }} style={s.hero} imageStyle={s.heroImage}>
      <View style={s.overlay} />
      <View style={s.heroContent}>
        <Text style={s.lightEyebrow}>Verified rentals across Kenya</Text>
        <Text style={s.heroTitle}>Your next home is <Text style={s.gold}>closer</Text> than you think.</Text>
        <Text style={s.heroBody}>Discover genuinely vacant homes, compare rent and amenities, then unlock the exact location and landlord contact securely.</Text>
        <View style={s.trust}><Text style={s.trustText}>✓ Verified listings</Text><Text style={s.trustText}>✓ M-Pesa payments</Text><Text style={s.trustText}>✓ No hidden agent fees</Text></View>
      </View>
    </ImageBackground>

    <View style={s.searchPanel}>
      <Text style={s.searchTitle}>Find homes in your budget</Text>
      <Text style={s.label}>Town</Text>
      <View style={s.pickerShell}><Picker selectedValue={preferences.town ?? ""} onValueChange={value => setPreferences(current => ({ ...current, town: value || null }))} style={s.picker}>
        <Picker.Item label="All towns" value="" />
        {(query.data?.towns ?? []).map(town => <Picker.Item key={town} label={town} value={town} />)}
      </Picker></View>
      <View style={s.budgetRow}>
        <View style={s.budgetField}><Text style={s.label}>Minimum rent</Text><View style={s.pickerShell}><Picker selectedValue={preferences.minRent ?? 0} onValueChange={value => setMinimum(value || null)} style={s.picker}><Picker.Item label="No minimum" value={0} />{budgetOptions.map(value => <Picker.Item key={value} label={`KSh ${value.toLocaleString("en-KE")}`} value={value} />)}</Picker></View></View>
        <View style={s.budgetField}><Text style={s.label}>Maximum rent</Text><View style={s.pickerShell}><Picker selectedValue={preferences.maxRent ?? 0} onValueChange={value => setMaximum(value || null)} style={s.picker}><Picker.Item label="No maximum" value={0} />{budgetOptions.map(value => <Picker.Item key={value} label={`KSh ${value.toLocaleString("en-KE")}`} value={value} />)}</Picker></View></View>
      </View>
      {!preferences.town && detectedTown ? <Text style={s.locationHint}>Prioritizing homes in {detectedTown} from your approximate location.</Text> : null}
      {!preferences.town && !detectedTown && !locationSettled ? <Text style={s.locationHint}>Checking your current town…</Text> : null}
    </View>

    <View style={s.stats}>{[[query.data?.stats.vacantHomes ?? 0, "vacant homes"], [query.data?.stats.townsCovered ?? 0, "towns covered"], [query.data?.stats.verifiedLandlordPercent ?? "—", "verified landlords"], [query.data?.stats.successfulUnlocks ?? 0, "successful unlocks"]].map(([value, label]) => <View style={s.stat} key={label}><Text style={s.statValue}>{value}{label === "verified landlords" && value !== "—" ? "%" : ""}</Text><Text style={s.statLabel}>{label}</Text></View>)}</View>
    <View style={s.section}>
      <Eyebrow>Available now</Eyebrow><H2>Homes worth moving for</H2>
      <View style={s.chips}>{["all", "Bedsitter", "1 Bedroom", "2 Bedroom", "3 Bedroom"].map(value => <Text key={value} onPress={() => setType(value)} style={[s.chip, type === value && s.chipActive]}>{value === "all" ? "All homes" : value}</Text>)}</View>
      {query.isLoading ? <Body muted>Loading verified homes…</Body> : query.error ? <Body muted>Homes could not be loaded. Pull to try again.</Body> : filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)}
      {!query.isLoading && !filtered.length ? <View style={s.empty}><H2>No exact matches yet</H2><Body muted>Try a different town, home type, or budget range.</Body></View> : null}
    </View>
    <View style={s.how}><Text style={s.lightEyebrow}>Simple and transparent</Text><Text style={s.howTitle}>From searching to viewing in three steps.</Text>{[["01", "Find your match", "Filter verified vacancies by location, home type, rent, and amenities."], ["02", "Unlock securely", "Pay the displayed one-time fee through M-Pesa."], ["03", "View and decide", "Arrange a visit directly. Never pay a deposit before seeing the home."]].map(([n, h, p]) => <View style={s.step} key={n}><Text style={s.stepNumber}>{n}</Text><View style={{ flex: 1 }}><Text style={s.stepTitle}>{h}</Text><Text style={s.stepBody}>{p}</Text></View></View>)}</View>
    <View style={s.section}><Eyebrow>Move with confidence</Eyebrow><H2>Safety is built into every listing.</H2><Body muted>Identity checks, property-document review, vacancy confirmation, user reports, and moderated contact help keep the marketplace trustworthy.</Body><Link href="/help" asChild><Button title="See our safety rules" secondary onPress={() => {}} /></Link></View>
  </Screen>;
}

const s = StyleSheet.create({
  hero: { minHeight: 570, justifyContent: "center" }, heroImage: { resizeMode: "cover" }, overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(6,62,50,.86)" }, heroContent: { paddingHorizontal: 18, paddingVertical: 45, gap: spacing.md }, lightEyebrow: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontFamily: typography.bodyBold }, heroTitle: { color: colors.white, fontFamily: typography.heading, fontSize: 39, lineHeight: 41, letterSpacing: -1 }, gold: { color: colors.gold }, heroBody: { color: "#dcece7", fontFamily: typography.body, fontSize: 16, lineHeight: 27 }, trust: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, trustText: { color: "#eef8f5", fontFamily: typography.bodyBold, fontSize: 13 },
  searchPanel: { margin: 18, marginTop: -34, padding: 18, borderRadius: radii.card, backgroundColor: colors.white, gap: 10, borderWidth: 1, borderColor: colors.line }, searchTitle: { color: colors.ink, fontFamily: typography.heading, fontSize: 22 }, label: { color: colors.ink, fontFamily: typography.bodyBold, fontSize: 13 }, pickerShell: { borderWidth: 1, borderColor: colors.inputLine, borderRadius: radii.input, overflow: "hidden", backgroundColor: colors.white }, picker: { color: colors.ink, minHeight: 50 }, budgetRow: { flexDirection: "row", gap: 10 }, budgetField: { flex: 1, gap: 7 }, locationHint: { color: colors.green, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  stats: { backgroundColor: colors.white, flexDirection: "row", flexWrap: "wrap", padding: 20, gap: 22 }, stat: { width: "45%", alignItems: "center" }, statValue: { color: colors.green, fontFamily: typography.heading, fontSize: 24 }, statLabel: { color: colors.muted, fontFamily: typography.body, fontSize: 12 }, section: { paddingHorizontal: 18, paddingVertical: 65, gap: 18, backgroundColor: "#fbfcfa" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: 10, paddingHorizontal: 16, color: colors.muted, fontFamily: typography.body }, chipActive: { color: colors.white, borderColor: colors.green, backgroundColor: colors.green }, empty: { padding: 30, backgroundColor: colors.cream, borderRadius: radii.card }, how: { backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 65, gap: 20 }, howTitle: { color: colors.white, fontFamily: typography.heading, fontSize: 31, lineHeight: 36 }, step: { flexDirection: "row", gap: 22, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.18)", paddingVertical: 20 }, stepNumber: { color: colors.gold, fontFamily: typography.heading, fontSize: 30 }, stepTitle: { color: colors.white, fontFamily: typography.headingRegular, fontSize: 18 }, stepBody: { color: "#cce0da", fontFamily: typography.body, lineHeight: 23 }
});
