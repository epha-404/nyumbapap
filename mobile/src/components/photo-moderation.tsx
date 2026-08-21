import { useEffect, useState } from "react";
import { File, Paths } from "expo-file-system";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { apiFetch, apiJson } from "@/lib/api";
import type { MobilePhotoItem } from "@/components/moderation-portal";
import { Body, Button, Card, Field, H2 } from "@/components/ui";
import { colors, radii, spacing, typography } from "../../theme";

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export function MobilePhotoModeration({ initialPhotos }: { initialPhotos: MobilePhotoItem[] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    for (const photo of photos) {
      if (previews[photo.id] || unavailable.has(photo.id)) continue;
      void apiFetch(photo.contentUrl).then(async response => {
        if (!response.ok) throw new Error("Photo unavailable");
        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        const file = new File(Paths.cache, `moderation-${photo.id}.${imageExtension(contentType)}`);
        file.write(new Uint8Array(await response.arrayBuffer()));
        if (active) setPreviews(current => ({ ...current, [photo.id]: file.uri }));
      }).catch(() => {
        if (active) setUnavailable(current => new Set(current).add(photo.id));
      });
    }
    return () => { active = false; };
  }, [photos, previews, unavailable]);

  async function decide(photo: MobilePhotoItem, decision: "APPROVE" | "REJECT") {
    setBusy(photo.id);
    try {
      await apiJson(`moderation/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, notes: notes[photo.id] ?? "" })
      });
      setPhotos(current => current.filter(item => item.id !== photo.id));
      Alert.alert("Decision saved", decision === "APPROVE" ? "The photo is approved for the live listing." : "The photo was rejected.");
    } catch (error) {
      Alert.alert("Could not save decision", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy("");
    }
  }

  return <View style={styles.section}>
    <View style={styles.heading}><H2>Listing interiors</H2><Text style={styles.badge}>{photos.length} pending</Text></View>
    {!photos.length ? <Card><Body muted>No listing photos are awaiting review.</Body></Card> : photos.map(photo => <Card key={photo.id}>
      {previews[photo.id] ? <Image source={{ uri: previews[photo.id] }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Interior submitted for ${photo.listingTitle}`} /> : <View style={styles.photoPlaceholder}><Body muted>{unavailable.has(photo.id) ? "Image unavailable — ask the landlord to upload it again." : "Loading protected image…"}</Body></View>}
      <H2>{photo.listingTitle}</H2>
      <Body muted>Submitted by {photo.submitterName}</Body>
      <Body muted>{new Date(photo.submittedAt).toLocaleString("en-KE")}</Body>
      <Field label="Reviewer notes (optional)" multiline value={notes[photo.id] ?? ""} maxLength={1000} onChangeText={value => setNotes(current => ({ ...current, [photo.id]: value }))} />
      <View style={styles.actions}>
        <View style={styles.action}><Button title="Approve" busy={busy === photo.id} disabled={Boolean(busy) || !previews[photo.id]} onPress={() => decide(photo, "APPROVE")} /></View>
        <View style={styles.action}><Button secondary title="Reject" disabled={Boolean(busy)} onPress={() => decide(photo, "REJECT")} /></View>
      </View>
    </Card>)}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { color: colors.green, backgroundColor: colors.paleGreen, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, fontFamily: typography.bodyBold },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.input, backgroundColor: colors.paleGreen },
  photoPlaceholder: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.input, backgroundColor: colors.paleGreen, alignItems: "center", justifyContent: "center", padding: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 }
});
