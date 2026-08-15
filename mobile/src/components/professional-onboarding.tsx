import { useEffect, useState } from "react";
import type { AppRole } from "@nyumbapap/contracts";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api";
import { Body, Button, Card, ErrorText, Field, H2 } from "./ui";

type Onboarding = { role: Extract<AppRole, "LANDLORD" | "AGENT">; name: string; verificationState: string; hasCredential: boolean };
type PickedFile = { uri: string; name: string; mimeType: string };

export function ProfessionalOnboarding() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["onboarding"], queryFn: () => apiJson<{ onboarding: Onboarding }>("onboarding") });
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [saved, setSaved] = useState<Onboarding | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState<"details" | "document" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const onboarding = saved ?? query.data?.onboarding ?? null;

  useEffect(() => { if (query.data?.onboarding) setName(query.data.onboarding.name); }, [query.data?.onboarding]);

  async function saveDetails() {
    if (!onboarding) return;
    setBusy("details"); setError(""); setMessage("");
    try {
      const body = onboarding.role === "AGENT" ? { agencyName: name, licenceNumber: credential } : { displayName: name, identityNumber: credential };
      const result = await apiJson<{ onboarding: Onboarding }>("onboarding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setSaved(result.onboarding); setCredential(""); setMessage("Professional details saved. You can now upload the verification document.");
      await client.invalidateQueries({ queryKey: ["onboarding"] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save professional details"); }
    finally { setBusy(null); }
  }

  async function chooseFile() {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) setFile({ uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? "application/octet-stream" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the file picker"); }
  }

  async function uploadDocument() {
    if (!onboarding?.hasCredential) return setError("Save your professional details before uploading evidence.");
    if (!file) return setError("Choose a verification document first.");
    setBusy("document"); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.append("document", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      const response = await apiFetch("onboarding/document", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not upload the document");
      setFile(null); setMessage(result.message ?? "Document submitted for verification");
      setSaved(current => current ? { ...current, verificationState: "PENDING" } : current);
      await Promise.all([client.invalidateQueries({ queryKey: ["onboarding"] }), client.invalidateQueries({ queryKey: ["dashboard"] })]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not upload the document"); }
    finally { setBusy(null); }
  }

  if (query.isLoading) return <Card><Body muted>Loading professional verification…</Body></Card>;
  if (query.error || !onboarding) return <Card><ErrorText message={query.error instanceof Error ? query.error.message : "Could not load professional verification"} /></Card>;
  return <Card>
    <H2>Professional verification</H2>
    <Body muted>Status: {onboarding.verificationState.replaceAll("_", " ")}</Body>
    <Field label={onboarding.role === "AGENT" ? "Agency name" : "Display name"} value={name} onChangeText={setName} />
    <Field label={onboarding.role === "AGENT" ? "Agent licence number" : "National ID or passport number"} value={credential} onChangeText={setCredential} autoCapitalize="none" />
    <Button busy={busy === "details"} title={onboarding.hasCredential ? "Resubmit details" : "Submit onboarding"} onPress={saveDetails} />
    <Body muted>{file ? `Selected: ${file.name}` : "No verification document selected."}</Body>
    <Button secondary disabled={!onboarding.hasCredential} title="Choose verification document" onPress={chooseFile} />
    <Button secondary busy={busy === "document"} disabled={!onboarding.hasCredential || !file} title={busy === "document" ? "Uploading…" : "Submit verification document"} onPress={uploadDocument} />
    {!onboarding.hasCredential ? <ErrorText message="Save your professional details before uploading evidence." /> : null}
    <ErrorText message={error} />
    {message ? <Body>{message}</Body> : null}
  </Card>;
}
