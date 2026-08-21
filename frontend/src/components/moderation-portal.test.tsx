import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ csrfFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ csrfFetch: mocks.csrfFetch }));

import { ModerationPortal, type ModerationData } from "./moderation-portal";

const data: ModerationData = {
  badgeDefinitions: {},
  identities: [],
  listings: [{ id: "listing-1", title: "Garden flat", unitType: "1 Bedroom", monthlyRentKes: 25_000, town: "Nairobi", area: "Kilimani", submittedAt: "2026-08-21T10:00:00.000Z" }],
  photos: [{ id: "photo-1", listingId: "listing-1", listingTitle: "Garden flat", width: 1200, height: 800, submittedAt: "2026-08-21T10:05:00.000Z", contentUrl: "/api/moderation/photos/photo-1/content" }]
};

describe("photo moderation portal", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("removes the approved photo and its terminal listing from both pending queues", async () => {
    mocks.csrfFetch.mockResolvedValue(new Response(JSON.stringify({ id: "photo-1", moderationState: "APPROVED", listingState: "APPROVED" }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<ModerationPortal initialData={data} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mocks.csrfFetch).toHaveBeenCalledWith("moderation/photos/photo-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ decision: "APPROVE", notes: "" })
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Photo approved.");
    expect(screen.queryByAltText("Interior submitted for Garden flat")).toBeNull();
    expect(screen.queryByText("Garden flat")).toBeNull();
    expect(screen.getAllByText("0 pending")).toHaveLength(3);
  });

  it("disables approval and explains the problem when the image preview cannot load", () => {
    render(<ModerationPortal initialData={data} />);
    fireEvent.error(screen.getByAltText("Interior submitted for Garden flat"));
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByText(/could not be loaded/i)).toBeVisible();
  });
});
