import { afterEach, describe, expect, it, vi } from "vitest";
import { NisokoObjectStorage } from "@/modules/storage/nisoko-storage";

describe("NisokoObjectStorage", () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
