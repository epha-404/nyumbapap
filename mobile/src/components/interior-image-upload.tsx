import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Body, Button, ErrorText } from "./ui";

export function InteriorImageUpload({ listingId }: { listingId: string }) {
  const client = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function upload() { setError(""); setMessage(""); const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return setError("Photo-library access is required to select interior images."); const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 1 }); if (selection.canceled) return; setBusy(true); try { const form = new FormData(); selection.assets.slice(0, 6).forEach((asset, index) => form.append("images", { uri: asset.uri, name: asset.fileName ?? `interior-${index + 1}.jpg`, type: asset.mimeType ?? "image/jpeg" } as unknown as Blob)); const response = await apiFetch(`dashboard/listings/${listingId}/images`, { method: "POST", body: form }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error ?? "Could not upload images"); const count = Array.isArray(result.images) ? result.images.length : 0; setMessage(`${count} image${count === 1 ? "" : "s"} uploaded.`); await client.invalidateQueries({ queryKey: ["dashboard"] }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not upload images"); } finally { setBusy(false); } }
  return <><Body muted>Interior images: up to 6 at once. JPEG, PNG, WebP, or AVIF.</Body><ErrorText message={error} />{message ? <Body>{message}</Body> : null}<Button secondary busy={busy} title={busy ? "Processing..." : "Select and upload interiors"} onPress={upload} /></>;
}
