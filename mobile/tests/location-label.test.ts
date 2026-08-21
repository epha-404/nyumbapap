import { describe, expect, it } from "vitest";
import { formatLocationLabel } from "@/lib/location-label";

describe("formatLocationLabel", () => {
  it("does not render a ward, town, or county twice", () => {
    expect(formatLocationLabel("Nyangati ward", " nyangati  ward ")).toBe("Nyangati ward");
    expect(formatLocationLabel("Kilimani", "Nairobi", "Nairobi")).toBe("Kilimani, Nairobi");
  });
});
