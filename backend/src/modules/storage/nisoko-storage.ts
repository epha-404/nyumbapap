import type { PrivateObjectStorage, RetrievedObject, StoredObject } from "./provider";

type UploadResponse = { id: string; filename: string; size: number; content_type: string };
type StoredReference = { id: string; filename: string; contentType: string };
const PREFIX = "nisoko:";
const encode = (reference: StoredReference) => `${PREFIX}${Buffer.from(JSON.stringify(reference)).toString("base64url")}`;
function decode(key: string): StoredReference { if (!key.startsWith(PREFIX)) throw new Error("INVALID_NISOKO_STORAGE_KEY"); return JSON.parse(Buffer.from(key.slice(PREFIX.length), "base64url").toString("utf8")) as StoredReference; }

export class NisokoObjectStorage implements PrivateObjectStorage {
  constructor(private readonly apiKey: string, private readonly container: string, private readonly baseUrl = "https://storage.nisoko.co.ke") {}
  static fromEnvironment() { const apiKey = process.env.NISOKO_STORAGE_API_KEY?.trim(); if (!apiKey) throw new Error("NISOKO_STORAGE_API_KEY is required"); return new NisokoObjectStorage(apiKey, process.env.NISOKO_STORAGE_CONTAINER ?? "nyumba-pap-assets", process.env.NISOKO_STORAGE_API_URL ?? "https://storage.nisoko.co.ke"); }
  private headers() { return { "X-API-Key": this.apiKey }; }
  async put(input: { key: string; body: Buffer; contentType: string }): Promise<StoredObject> { const form = new FormData(); form.append("file", new Blob([new Uint8Array(input.body)], { type: input.contentType }), input.key); const response = await fetch(`${this.baseUrl}/api/v1/storage/containers/${encodeURIComponent(this.container)}/upload`, { method: "POST", headers: this.headers(), body: form, signal: AbortSignal.timeout(30_000) }); const text = await response.text(); if (!response.ok) throw new Error(`NISOKO_STORAGE_UPLOAD_FAILED:${response.status}:${text.slice(0, 500)}`); const uploaded = JSON.parse(text) as UploadResponse; if (!uploaded.id || !uploaded.filename) throw new Error("NISOKO_STORAGE_INVALID_UPLOAD_RESPONSE"); const contentType = uploaded.content_type || input.contentType; return { key: encode({ id: uploaded.id, filename: uploaded.filename, contentType }), sizeBytes: uploaded.size || input.body.length, contentType }; }
  async get(key: string): Promise<RetrievedObject> { const reference = decode(key); const response = await fetch(`${this.baseUrl}/api/v1/storage/containers/${encodeURIComponent(this.container)}/download/${encodeURIComponent(reference.filename)}`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) }); if (!response.ok) throw new Error(`NISOKO_STORAGE_DOWNLOAD_FAILED:${response.status}`); return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? reference.contentType, cacheControl: response.headers.get("cache-control") ?? "public, max-age=31536000, immutable" }; }
  async delete(key: string) { const reference = decode(key); const response = await fetch(`${this.baseUrl}/api/v1/storage/files/${encodeURIComponent(reference.id)}`, { method: "DELETE", headers: this.headers(), signal: AbortSignal.timeout(20_000) }); if (!response.ok && response.status !== 404) throw new Error(`NISOKO_STORAGE_DELETE_FAILED:${response.status}`); }
}
