import type { PrivateObjectStorage, RetrievedObject, StoredObject } from "./provider";

type UploadResponse = { id: string; filename: string; size: number; content_type: string };
type StoredReference = { id: string; filename: string; contentType: string };
const PREFIX = "nisoko:";
const MAX_ATTEMPTS = 3;
const encode = (reference: StoredReference) => `${PREFIX}${Buffer.from(JSON.stringify(reference)).toString("base64url")}`;
function decode(key: string): StoredReference {
  if (!key.startsWith(PREFIX)) throw new Error("INVALID_NISOKO_STORAGE_KEY");
  return JSON.parse(Buffer.from(key.slice(PREFIX.length), "base64url").toString("utf8")) as StoredReference;
}
function transientStatus(status: number) { return status === 408 || status === 429 || status >= 500; }

export class NisokoStorageError extends Error {
  constructor(public readonly operation: string, public readonly status: number, public readonly retryable: boolean, detail = "") {
    super(`NISOKO_STORAGE_${operation}_FAILED:${status}${detail ? `:${detail}` : ""}`);
    this.name = "NisokoStorageError";
  }
}

export class NisokoObjectStorage implements PrivateObjectStorage {
  constructor(
    private readonly apiKey: string,
    private readonly container: string,
    private readonly baseUrl = "https://storage.nisoko.co.ke",
    private readonly sleep: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  ) {}

  static fromEnvironment() {
    const apiKey = process.env.NISOKO_STORAGE_API_KEY?.trim();
    if (!apiKey) throw new Error("NISOKO_STORAGE_API_KEY is required");
    return new NisokoObjectStorage(apiKey, process.env.NISOKO_STORAGE_CONTAINER ?? "nyumba-pap-assets", process.env.NISOKO_STORAGE_API_URL ?? "https://storage.nisoko.co.ke");
  }

  private headers() { return { "X-API-Key": this.apiKey }; }

  private async request(operation: string, makeRequest: () => Promise<Response>) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await makeRequest();
        if (!transientStatus(response.status) || attempt === MAX_ATTEMPTS) return response;
        const retryAfter = Math.min(2_000, Math.max(0, Number(response.headers.get("retry-after")) * 1_000 || 0));
        await response.body?.cancel().catch(() => undefined);
        await this.sleep(retryAfter || 250 * 2 ** (attempt - 1));
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) throw new NisokoStorageError(operation, 0, true, error instanceof Error ? error.name : "NetworkError");
        await this.sleep(250 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  async put(input: { key: string; body: Buffer; contentType: string }): Promise<StoredObject> {
    const response = await this.request("UPLOAD", () => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(input.body)], { type: input.contentType }), input.key);
      return fetch(`${this.baseUrl}/api/v1/storage/containers/${encodeURIComponent(this.container)}/upload`, { method: "POST", headers: this.headers(), body: form, signal: AbortSignal.timeout(30_000) });
    });
    const text = await response.text();
    if (!response.ok) throw new NisokoStorageError("UPLOAD", response.status, transientStatus(response.status), text.slice(0, 500));
    const uploaded = JSON.parse(text) as UploadResponse;
    if (!uploaded.id || !uploaded.filename) throw new NisokoStorageError("UPLOAD", response.status, false, "InvalidResponse");
    const contentType = uploaded.content_type || input.contentType;
    return { key: encode({ id: uploaded.id, filename: uploaded.filename, contentType }), sizeBytes: uploaded.size || input.body.length, contentType };
  }

  async get(key: string): Promise<RetrievedObject> {
    const reference = decode(key);
    const response = await this.request("DOWNLOAD", () => fetch(`${this.baseUrl}/api/v1/storage/containers/${encodeURIComponent(this.container)}/download/${encodeURIComponent(reference.filename)}`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) }));
    if (!response.ok) throw new NisokoStorageError("DOWNLOAD", response.status, transientStatus(response.status));
    return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? reference.contentType, cacheControl: response.headers.get("cache-control") ?? "public, max-age=31536000, immutable" };
  }

  async delete(key: string) {
    const reference = decode(key);
    const response = await this.request("DELETE", () => fetch(`${this.baseUrl}/api/v1/storage/files/${encodeURIComponent(reference.id)}`, { method: "DELETE", headers: this.headers(), signal: AbortSignal.timeout(20_000) }));
    if (!response.ok && response.status !== 404) throw new NisokoStorageError("DELETE", response.status, transientStatus(response.status));
  }
}
