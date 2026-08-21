import { useState } from "react";
import MapView, { Marker, MapPressEvent, MarkerDragStartEndEvent } from "react-native-maps";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Picker } from "@react-native-picker/picker";
import { StyleSheet, Switch, Text, View } from "react-native";
import { apiJson } from "@/lib/api";
import { UNIT_TYPES } from "@/lib/unit-types";
import { Body, Button, Card, ErrorText, Field, H2 } from "./ui";
import { colors, radii, spacing, typography } from "../../theme";

type Point = { latitude: number; longitude: number };
const initialPoint = { latitude: -1.286389, longitude: 36.817223 };
const inKenya = ({ latitude, longitude }: Point) => latitude >= -4.9 && latitude <= 5.1 && longitude >= 33.9 && longitude <= 41.9 && !(latitude === 0 && longitude === 0);

export function ListingForm({ onCreated, onCancel }: { onCreated?: (listingId: string) => void; onCancel?: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [point, setPoint] = useState<Point>(initialPoint);
  const [confirmed, setConfirmed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ county: "Nairobi", town: "Nairobi", area: "Pending location lookup", unitType: "1 Bedroom", bedrooms: "1", bathrooms: "1", size: "45", deposit: "0" });
  const [idempotencyKey] = useState(() => Crypto.randomUUID());
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));

  async function locate() {
    if ((values.address ?? "").trim().length < 3) return;
    setLocating(true); setError("");
    try {
      const result = await apiJson<{ results: Point[] }>(`geocoding/locate?q=${encodeURIComponent(values.address)}`);
      if (!result.results[0]) throw new Error("No Kenyan location matched that address.");
      setPoint(result.results[0]); setConfirmed(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not locate address"); }
    finally { setLocating(false); }
  }

  function move(next: Point) {
    if (!inKenya(next)) return setError("Choose a location inside Kenya.");
    setPoint(next); setConfirmed(false); setError("");
  }

  async function submit() {
    if (!confirmed) return setError("Confirm the pin before submitting.");
    setBusy(true); setError("");
    try {
      const result = await apiJson<{ id: string }>("dashboard/listings", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ ...values, latitude: String(point.latitude), longitude: String(point.longitude), locationConfirmed: "true" }) });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
      onCreated?.(result.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save listing"); }
    finally { setBusy(false); }
  }

  const fields = [["title", "Listing title"], ["description", "Description"], ["county", "County"], ["town", "Town"], ["area", "Area"], ["address", "Nearest landmark or building name (optional)"], ["contact", "Owner contact"], ["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"], ["size", "Size (square metres)"], ["rent", "Monthly rent (KES)"], ["deposit", "Deposit (KES)"]];
  return <Card>
    <H2>List a property</H2>
    <Body muted>Set the exact location with the map pin. A landmark is optional; exact coordinates and notes stay protected while the backend derives the public coarse location.</Body>
    {fields.map(([key, label]) => <Field key={key} label={label} value={values[key] ?? ""} onChangeText={value => set(key, value)} multiline={key === "description"} keyboardType={["bedrooms", "bathrooms", "size", "rent", "deposit"].includes(key) ? "number-pad" : "default"} />)}
    <View style={s.categoryField}>
      <Text style={s.label}>Home type</Text>
      <View style={s.pickerShell}>
        <Picker selectedValue={values.unitType} onValueChange={(value) => set("unitType", value)} style={s.picker}>
          {UNIT_TYPES.map((unitType) => <Picker.Item key={unitType} label={unitType} value={unitType} />)}
        </Picker>
      </View>
    </View>
    <Button secondary busy={locating} disabled={(values.address ?? "").trim().length < 3} title={locating ? "Locating…" : "Locate landmark"} onPress={locate} />
    <MapView style={s.map} region={{ ...point, latitudeDelta: .18, longitudeDelta: .18 }} onPress={(event: MapPressEvent) => move(event.nativeEvent.coordinate)}><Marker coordinate={point} draggable pinColor={colors.orange} onDragEnd={(event: MarkerDragStartEndEvent) => move(event.nativeEvent.coordinate)} /></MapView>
    <View style={s.confirm}><Text style={s.label}>Confirm exact pin location</Text><Switch value={confirmed} onValueChange={setConfirmed} trackColor={{ true: colors.green }} /></View>
    <ErrorText message={error} />
    <Button busy={busy} title={busy ? "Saving..." : "Submit for review"} onPress={submit} />
    {onCancel ? <Button secondary title="Cancel" onPress={onCancel} /> : null}
  </Card>;
}

const s = StyleSheet.create({ map: { height: 360, borderRadius: radii.card }, categoryField: { gap: 7 }, pickerShell: { borderWidth: 1, borderColor: colors.inputLine, borderRadius: radii.input, overflow: "hidden", backgroundColor: colors.white }, picker: { color: colors.ink, minHeight: 50 }, confirm: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }, label: { flex: 1, color: colors.ink, fontFamily: typography.bodyBold } });
