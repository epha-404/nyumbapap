import { afterEach, describe, expect, it, vi } from "vitest";
import { NisokoObjectStorage } from "@/modules/storage/nisoko-storage";

describe("NisokoObjectStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NISOKO_STORAGE_API_KEY;
    delete process.env.NISOKO_STORAGE_CONTAINER;
    delete process.env.NISOKO_PRIVATE_DOCUMENTS_CONTAINER;
  });

  it("uploads listing images as multipart and uses the returned object reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "file-id",
      filename: "media_123.webp",
      size: 321,
      content_type: "image/webp"
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new NisokoObjectStorage("test-key", "nyumba-pap-assets");

    const stored = await storage.put({ key: "listing/room.webp", body: Buffer.from("image"), contentType: "image/webp" });

    expect(stored).toMatchObject({ sizeBytes: 321, contentType: "image/webp" });
    expect(stored.key).toMatch(/^nisoko:/);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://storage.nisoko.co.ke/api/v1/storage/containers/nyumba-pap-assets/upload");
    expect(request).toMatchObject({ method: "POST", headers: { "X-API-Key": "test-key" } });
    expect(request.body).toBeInstanceOf(FormData);
  });

  it("downloads and deletes using the opaque stored reference", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "file-id", filename: "room.webp", size: 5, content_type: "image/webp" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/webp" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new NisokoObjectStorage("test-key", "nyumba-pap-assets");
    const stored = await storage.put({ key: "room.webp", body: Buffer.from("image"), contentType: "image/webp" });

    expect(await storage.get(stored.key)).toMatchObject({ contentType: "image/webp" });
    await storage.delete(stored.key);
    expect(fetchMock.mock.calls[1][0]).toContain("/download/room.webp");
    expect(fetchMock.mock.calls[2][0]).toBe("https://storage.nisoko.co.ke/api/v1/storage/files/file-id");
  });

  it("retries transient upload failures with bounded backoff", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error("network"), { name: "TypeError" }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "file-id", filename: "room.webp", size: 5, content_type: "image/webp" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const storage = new NisokoObjectStorage("test-key", "nyumba-pap-assets", "https://storage.nisoko.co.ke", sleep);
    await expect(storage.put({ key: "room.webp", body: Buffer.from("image"), contentType: "image/webp" })).resolves.toMatchObject({ sizeBytes: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("keeps private documents in their private container and retrieves byte-identical content", async () => {
    const original = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "document-id", filename: "identity.pdf", size: original.length, content_type: "application/pdf" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ signed_url: "https://storage.nisoko.co.ke/private-download?token=signed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(original, { status: 200, headers: { "content-type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.NISOKO_STORAGE_API_KEY = "private-key";
    process.env.NISOKO_STORAGE_CONTAINER = "nyumba-pap-assets";
    process.env.NISOKO_PRIVATE_DOCUMENTS_CONTAINER = "nyumba-pap-private-docs";

    const storage = NisokoObjectStorage.privateDocumentsFromEnvironment();
    const stored = await storage.put({ key: "identity.pdf", body: Buffer.from(original), contentType: "application/pdf" });
    const retrieved = await storage.get(stored.key);

    expect(fetchMock.mock.calls[0][0]).toContain("/containers/nyumba-pap-private-docs/upload");
    expect(fetchMock.mock.calls[1][0]).toContain("/containers/nyumba-pap-private-docs/files/identity.pdf/signed");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { "X-API-Key": "private-key" } });
    expect(fetchMock.mock.calls[2][0]).toContain("/private-download?token=signed");
    expect(fetchMock.mock.calls[2][1]).not.toHaveProperty("headers.X-API-Key");
    expect(retrieved.body).toEqual(original);
    expect(retrieved.cacheControl).toBe("private, no-store");
  });

  it("refuses to configure private documents in the public assets container", () => {
    process.env.NISOKO_STORAGE_API_KEY = "private-key";
    process.env.NISOKO_STORAGE_CONTAINER = "nyumba-pap-assets";
    process.env.NISOKO_PRIVATE_DOCUMENTS_CONTAINER = "nyumba-pap-assets";
    expect(() => NisokoObjectStorage.privateDocumentsFromEnvironment()).toThrow("Private documents must not use the public listing-media container");
  });
});
