import { describe, expect, it } from "vitest";
import { formatLocationLabel } from "./location-label";

describe("formatLocationLabel", () => {
  it("removes repeated location parts without changing distinct parts", () => {
    expect(formatLocationLabel("Nyangati ward", "Nyangati ward", "Kirinyaga")).toBe("Nyangati ward, Kirinyaga");
    expect(formatLocationLabel("Kilimani", "Nairobi", "Nairobi")).toBe("Kilimani, Nairobi");
  });
});
