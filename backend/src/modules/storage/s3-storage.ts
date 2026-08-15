import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PrivateObjectStorage, RetrievedObject, StoredObject } from "./provider";

export class S3PrivateStorage implements PrivateObjectStorage {
  constructor(private readonly client: S3Client, private readonly bucket: string) {}
  static fromEnvironment() {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined
    });
    if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is required");
    return new S3PrivateStorage(client, process.env.S3_BUCKET);
  }
  async put(input: { key: string; body: Buffer; contentType: string; cacheControl?: string }): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: input.body, ContentType: input.contentType, CacheControl: input.cacheControl, ServerSideEncryption: "AES256" }));
    return { key: input.key, sizeBytes: input.body.length, contentType: input.contentType };
  }
  async get(key: string): Promise<RetrievedObject> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!object.Body) throw new Error("STORED_OBJECT_EMPTY");
    return {
      body: await object.Body.transformToByteArray(),
      contentType: object.ContentType ?? "application/octet-stream",
      cacheControl: object.CacheControl
    };
  }
  async delete(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
}
