import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => <div aria-label="Exact listing location map" /> }));
vi.mock("@/lib/api", () => ({ apiPath: (path: string) => `/api/${path}`, csrfFetch: vi.fn() }));

import { ListingForm } from "./listing-form";

describe("web listing exact-location form", () => {
  afterEach(() => cleanup());

  it("uses the map pin as the required exact location and keeps the landmark optional", () => {
    render(<ListingForm />);
    expect(screen.queryByLabelText("Exact address")).toBeNull();
    const landmark = screen.getByLabelText("Nearest landmark or building name (optional)") as HTMLInputElement;
    expect(landmark.required).toBe(false);
    expect(screen.getByLabelText("Exact listing location map")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm pin location" })).toBeTruthy();
  });

  it("offers Single room immediately after Bedsitter", () => {
    render(<ListingForm />);
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options.slice(0, 2)).toEqual(["Bedsitter", "Single room"]);
  });
});
