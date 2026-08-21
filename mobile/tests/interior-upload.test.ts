import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiMultipart: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiMultipart: mocks.apiMultipart }));

import { uploadInteriorImages } from "@/lib/interior-upload";

type ReactNativeFormData = FormData & { getParts(): Array<Record<string, unknown>> };
const OriginalFormData = globalThis.FormData;

class InspectableFormData {
  parts: Array<Record<string, unknown>> = [];
  append(fieldName: string, value: Record<string, unknown>) { this.parts.push({ ...value, fieldName }); }
  getParts() { return this.parts; }
}

describe("interior image upload", () => {
  beforeEach(() => {
    globalThis.FormData = InspectableFormData as unknown as typeof FormData;
    mocks.apiMultipart.mockImplementation(async (_path: string, form: ReactNativeFormData) => ({ ok: true, status: 201, json: async () => ({ images: [{ id: form.getParts()[0].name }] }) }));
  });
  afterEach(() => { globalThis.FormData = OriginalFormData; vi.clearAllMocks(); });

  it("uploads selected photos one at a time as native URI parts", async () => {
    const progress = vi.fn();
    const files = [
      { uri: "file:///one.jpg", name: "one.jpg", mimeType: "image/jpeg" },
      { uri: "content://gallery/two.png", name: "two.png", mimeType: "image/png" }
    ];
    const uploaded = await uploadInteriorImages("listing-1", files, progress);
    expect(mocks.apiMultipart).toHaveBeenCalledTimes(2);
    for (const [, form] of mocks.apiMultipart.mock.calls) {
      expect((form as ReactNativeFormData).getParts()).toHaveLength(1);
      expect((form as ReactNativeFormData).getParts()[0]).toMatchObject({ uri: expect.any(String), name: expect.any(String), type: expect.stringMatching(/^image\//), fieldName: "images" });
    }
    expect(uploaded).toHaveLength(2);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });
});
