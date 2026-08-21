import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiFetch, apiJson } from "@/lib/api";
import { Body, Button, Card, Field, H2 } from "@/components/ui";
import { colors, radii, spacing, typography } from "../../theme";

export type MobileIdentityItem = {
  id: string;
  kind: string;
  role: string;
  subjectName: string;
  submittedAt: string;
  documentUrl: string;
};

export type MobileModerationData = {
  identities: MobileIdentityItem[];
  photos: Array<{ id: string }>;
  listings: Array<{ id: string }>;
};

function extensionFor(contentType: string) {
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export function MobileModerationPortal({ initialData }: { initialData: MobileModerationData }) {
  const [identities, setIdentities] = useState(initialData.identities);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  async function openDocument(item: MobileIdentityItem) {
    setBusy(`document:${item.id}`);
    try {
      const response = await apiFetch(item.documentUrl);
      if (!response.ok) throw new Error("The private document could not be loaded");
      if (!(await Sharing.isAvailableAsync())) throw new Error("No document viewer is available on this device");
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const file = new File(Paths.cache, `verification-${item.id}.${extensionFor(contentType)}`);
      file.write(new Uint8Array(await response.arrayBuffer()));
      await Sharing.shareAsync(file.uri, { mimeType: contentType, dialogTitle: "Open verification document" });
    } catch (error) {
      Alert.alert("Could not open document", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy("");
    }
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id);
    try {
      await apiJson(`moderation/identities/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, notes: notes[id] ?? "" })
      });
      setIdentities((current) => current.filter((item) => item.id !== id));
      Alert.alert("Decision saved", decision === "APPROVE" ? "The landlord is now verified." : "The verification request was rejected.");
    } catch (error) {
      Alert.alert("Could not save decision", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy("");
    }
  }

  return <View style={styles.section}>
    <View style={styles.heading}><H2>Landlord verification</H2><Text style={styles.badge}>{identities.length} pending</Text></View>
    <Body muted>{initialData.listings.length} listings and {initialData.photos.length} interior photos are also awaiting review.</Body>
    {!identities.length ? <Card><Body muted>No identity documents are awaiting review.</Body></Card> : identities.map((item) => <Card key={item.id}>
      <Text style={styles.kind}>{item.kind.replaceAll("_", " ")}</Text>
      <H2>{item.subjectName}</H2>
      <Body muted>{item.role} · submitted {new Date(item.submittedAt).toLocaleString("en-KE")}</Body>
      <Button secondary title="Open private document" busy={busy === `document:${item.id}`} disabled={Boolean(busy)} onPress={() => openDocument(item)} />
      <Field label="Reviewer notes (optional)" multiline value={notes[item.id] ?? ""} maxLength={1000} onChangeText={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} />
      <View style={styles.actions}>
        <View style={styles.action}><Button title="Approve" busy={busy === item.id} disabled={Boolean(busy)} onPress={() => decide(item.id, "APPROVE")} /></View>
        <View style={styles.action}><Button secondary title="Reject" disabled={Boolean(busy)} onPress={() => decide(item.id, "REJECT")} /></View>
      </View>
    </Card>)}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { color: colors.green, backgroundColor: colors.paleGreen, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, fontFamily: typography.bodyBold },
  kind: { alignSelf: "flex-start", color: colors.green, fontFamily: typography.bodyBold, fontSize: 12, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 }
});
