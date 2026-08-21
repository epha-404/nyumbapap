import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { uploadInteriorImages } from "@/lib/interior-upload";
import { Body, Button, ErrorText } from "./ui";

export function InteriorImageUpload({ listingId }: { listingId: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [uploadState, setUploadState] = useState<"IDLE" | "UPLOADING" | "FAILED" | "SUCCEEDED">("IDLE");
  async function upload() {
    setError(""); setMessage(""); setProgress("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return setError("Photo-library access is required to select interior images.");
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.75 });
      if (selection.canceled) return;
      setBusy(true); setUploadState("UPLOADING");
      const files = selection.assets.slice(0, 6).map((asset, index) => ({ uri: asset.uri, name: asset.fileName ?? `interior-${index + 1}.jpg`, mimeType: asset.mimeType ?? "image/jpeg" }));
      const images = await uploadInteriorImages(listingId, files, (completed, total) => setProgress(`Uploaded photo ${completed} of ${total}.`));
      setMessage(`${images.length} image${images.length === 1 ? "" : "s"} uploaded.`);
      setUploadState("SUCCEEDED");
      await client.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (caught) {
      setUploadState("FAILED");
      setError(caught instanceof Error ? caught.message : "Could not upload images");
    } finally {
      setBusy(false); setProgress("");
    }
  }
  return <>
    <Body muted>Interior images: select up to 6. They are compressed for transfer, uploaded one at a time, then safely reprocessed by the server.</Body>
    {uploadState === "UPLOADING" ? <Body muted>{progress || "Preparing photos…"}</Body> : null}
    {uploadState === "FAILED" ? <Body muted>Upload failed safely. Retry when your connection or media storage recovers.</Body> : null}
    <ErrorText message={error} />
    {message ? <Body>{message}</Body> : null}
    <Button secondary busy={busy} title={busy ? "Processing..." : uploadState === "FAILED" ? "Retry interior upload" : "Select and upload interiors"} onPress={upload} />
  </>;
}
