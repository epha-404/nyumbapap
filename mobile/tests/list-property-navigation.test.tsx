import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Alert: { alert: vi.fn() } }));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() } }));
vi.mock("@/components/ui", () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => React.createElement("button", { onPress }, title),
  Screen: ({ children }: { children: React.ReactNode }) => React.createElement("screen", null, children),
  Body: ({ children }: { children: React.ReactNode }) => React.createElement("body-text", null, children),
  Eyebrow: ({ children }: { children: React.ReactNode }) => React.createElement("eyebrow", null, children),
  H1: ({ children }: { children: React.ReactNode }) => React.createElement("heading", null, children)
}));
vi.mock("@/providers/app-provider", () => ({ useAuth: () => ({ loading: false, session: { role: "LANDLORD" } }) }));
vi.mock("@/components/listing-form", () => ({ ListingForm: () => React.createElement("listing-form", null, "Listing form rendered") }));

import { ListPropertyCta, LISTING_CREATE_ROUTE } from "@/components/list-property-cta";
import NewListingScreen from "../app/dashboard/listings/new";

describe("landlord listing CTA", () => {
  it("navigates to the real create route and renders the listing form", () => {
    const navigate = vi.fn();
    let cta: ReturnType<typeof create>;
    act(() => { cta = create(<ListPropertyCta navigate={navigate} />); });
    act(() => { cta!.root.findByType("button").props.onPress(); });
    expect(navigate).toHaveBeenCalledWith(LISTING_CREATE_ROUTE);

    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<NewListingScreen />); });
    expect(screen!.root.find(node => String(node.type) === "listing-form")).toBeTruthy();
  });
});
