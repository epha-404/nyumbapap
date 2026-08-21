import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingCard } from "@/modules/listings/types";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a> }));
import { Marketplace } from "./marketplace";

const listing: ListingCard = { id: "listing-1", title: "Nakuru home", town: "Nakuru", approximateArea: "Section 58", unitType: "1 Bedroom", monthlyRentKes: 25000, sizeSquareMetres: 45, bathrooms: 1, verified: true, imageUrl: "https://images.unsplash.com/example" };
const stats = { vacantHomes: 1, townsCovered: 2, verifiedLandlordPercent: 100, successfulUnlocks: 0 };

describe("web marketplace server-backed search", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => error?.({} as GeolocationPositionError) } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], towns: ["Nairobi", "Nakuru"], stats }), { status: 200, headers: { "content-type": "application/json" } })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("uses API towns and sends the combined town and budget range", async () => {
    render(<Marketplace initialListings={[listing]} initialTowns={["Nakuru"]} stats={stats} />);
    fireEvent.change(screen.getByLabelText("Where do you want to live?"), { target: { value: "Nakuru" } });
    fireEvent.change(screen.getByLabelText("Minimum monthly rent"), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("Maximum monthly rent"), { target: { value: "40000" } });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("town=Nakuru") && String(url).includes("minRent=15000") && String(url).includes("maxRent=40000"))).toBe(true));
    expect(screen.getByRole("option", { name: "Nakuru" })).toBeTruthy();
  });

  it("uses a coarse browser location to request town-first default ranking", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: -1.286389, longitude: 36.817223 } } as GeolocationPosition) } });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [], towns: ["Nairobi"], detectedTown: "Nairobi", stats }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<Marketplace initialListings={[listing]} initialTowns={["Nakuru"]} stats={stats} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("nearLat=-1.286") && String(url).includes("nearLng=36.817"))).toBe(true));
    expect(await screen.findByText("Prioritizing homes in Nairobi from your approximate location.")).toBeTruthy();
  });
});
