export type StoredObject = { key: string; sizeBytes: number; contentType: string };
export type RetrievedObject = { body: Uint8Array; contentType: string; cacheControl?: string };
export interface PrivateObjectStorage {
  put(input: { key: string; body: Buffer; contentType: string; cacheControl?: string }): Promise<StoredObject>;
  get(key: string): Promise<RetrievedObject>;
  delete(key: string): Promise<void>;
}
