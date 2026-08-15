import { describe, expect, it, vi } from "vitest";
import { S3PrivateStorage } from "@/modules/storage/s3-storage";

describe("private identity-document storage", () => {
  it("requests server-side encryption and private cache semantics", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3PrivateStorage({ send } as never, "identity-private");
    await storage.put({ key: "verification-documents/id.jpg", body: Buffer.from("document"), contentType: "image/jpeg", cacheControl: "private, no-store" });
    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({ Bucket: "identity-private", Key: "verification-documents/id.jpg", ServerSideEncryption: "AES256", CacheControl: "private, no-store" });
  });
});
