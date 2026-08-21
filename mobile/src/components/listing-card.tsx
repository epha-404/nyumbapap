import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { absoluteMediaUrl } from "@/lib/api";
import { formatLocationLabel } from "@/lib/location-label";
import type { ListingCard as Listing } from "@/lib/types";
import { colors, radii, shadows, spacing, typography } from "../../theme";

export function ListingCard({ listing }: { listing: Listing }) {
  const image = absoluteMediaUrl(listing.media[0]?.url);
  const location = formatLocationLabel(listing.unit.property.approximateArea, listing.unit.property.town);
  return <Pressable onPress={() => router.push({ pathname: "/listings/[id]", params: { id: listing.id } })} style={({ pressed }) => [s.card, pressed && { opacity: 0.88 }]}>
    {image ? <Image source={{ uri: image }} style={s.image} accessibilityLabel={`Preview of ${listing.title}`} /> : <View style={[s.image, s.placeholder]}><Text style={s.placeholderText}>Interior photos pending</Text></View>}
    {listing.badge?.state === "verified" || listing.badge?.state === "expiring" ? <Text style={s.badge}>{listing.badge.label}</Text> : null}
    <View style={s.body}>
      {listing.landlordBadge ? <Text style={[s.landlordBadge, listing.landlordBadge.state === "unverified" && s.unverifiedBadge]}>{listing.landlordBadge.label}</Text> : null}
      <Text style={s.location}>⌖ {location}</Text>
      <Text style={s.title}>{listing.title}</Text>
      <View style={s.facts}><Text style={s.fact}>▣ {listing.unit.unitType}</Text><Text style={s.fact}>◫ {listing.unit.bathrooms} bath</Text><Text style={s.fact}>↔ {listing.unit.sizeSquareMetres ?? "—"} m²</Text></View>
      <Text style={s.price}>KSh {listing.unit.monthlyRentKes.toLocaleString("en-KE")} <Text style={s.per}>/ month</Text></Text>
      <View style={s.action}><Text style={s.actionText}>View details</Text></View>
    </View>
  </Pressable>;
}
const s = StyleSheet.create({ card: { position: "relative", backgroundColor: colors.white, borderWidth: 1, borderColor: "#e6ebe8", borderRadius: radii.property, overflow: "hidden", ...shadows.card }, image: { width: "100%", height: 230 }, placeholder: { backgroundColor: "#dfe7e2", alignItems: "center", justifyContent: "center" }, placeholderText: { color: colors.muted, fontFamily: typography.body }, badge: { position: "absolute", top: 14, left: 14, backgroundColor: colors.white, color: colors.green, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7, fontSize: 11, fontFamily: typography.bodyBold }, landlordBadge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, color: colors.green, backgroundColor: colors.paleGreen, fontFamily: typography.bodyBold }, unverifiedBadge: { color: "#7a4b00", backgroundColor: "#fff1d6", borderWidth: 1, borderColor: "#e7c47c" }, body: { padding: 19, gap: 8 }, location: { color: colors.muted, fontSize: 13, fontFamily: typography.body }, title: { color: colors.ink, fontFamily: typography.headingRegular, fontSize: 18 }, facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, borderTopWidth: 1, borderTopColor: "#edf0ed", marginTop: 8, paddingTop: 14 }, fact: { color: "#586963", fontSize: 12, fontFamily: typography.body }, price: { color: colors.green, fontFamily: typography.heading, fontSize: 19, marginTop: 6 }, per: { color: colors.muted, fontFamily: typography.body, fontSize: 12 }, action: { marginTop: 8, padding: 11, borderWidth: 1, borderColor: colors.green, borderRadius: 9, alignItems: "center" }, actionText: { color: colors.green, fontFamily: typography.bodyBold } });
