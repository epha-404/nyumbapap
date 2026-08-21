import { afterEach, describe, expect, it, vi } from "vitest";
import { coordinatesAreInKenya, jitterCoordinates, resolveTownAtCoordinates } from "@/modules/listings/location";

describe("listing location privacy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts Kenyan coordinates and rejects null island and foreign points", () => {
    expect(coordinatesAreInKenya({ latitude: -1.286389, longitude: 36.817223 })).toBe(true);
    expect(coordinatesAreInKenya({ latitude: 0, longitude: 0 })).toBe(false);
    expect(coordinatesAreInKenya({ latitude: -6.8, longitude: 39.2 })).toBe(false);
  });

  it("jitters by a random 150-400 metre radius rather than rounding", () => {
    const values = [275, 90];
    const point = jitterCoordinates({ latitude: -1.286389, longitude: 36.817223 }, () => values.shift()!);
    const metresPerDegree = 111_320;
    const distance = Math.hypot(
      (point.latitude + 1.286389) * metresPerDegree,
      (point.longitude - 36.817223) * metresPerDegree * Math.cos(-1.286389 * Math.PI / 180)
    );
    expect(distance).toBeGreaterThanOrEqual(274);
    expect(distance).toBeLessThanOrEqual(276);
    expect(point.longitude).not.toBe(36.817223);
  });

  it("resolves the detected public town without storing or returning the coordinate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ address: { city: "Nairobi" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveTownAtCoordinates({ latitude: -1.286, longitude: 36.817 })).resolves.toBe("Nairobi");
    expect(String(fetchMock.mock.calls[0][0])).toContain("reverse");
  });
});
