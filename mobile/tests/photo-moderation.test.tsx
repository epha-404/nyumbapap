import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  alert: vi.fn(),
  push: vi.fn(),
  auth: { loading: false, session: { role: "ADMIN" } as { role: string } | null }
}));

vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert },
  Image: (props: Record<string, unknown>) => React.createElement("image", props),
  Platform: { select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: { children: React.ReactNode }) => React.createElement("text", null, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement("view", null, children)
}));
vi.mock("expo-file-system", () => ({
  File: class { uri: string; constructor(_path: unknown, name: string) { this.uri = `file:///cache/${name}`; } write() {} },
  Paths: { cache: {} }
}));
vi.mock("expo-router", () => ({ router: { push: mocks.push, replace: vi.fn(), back: vi.fn() } }));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch, apiJson: mocks.apiJson }));
vi.mock("@/providers/app-provider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ enabled }: { enabled: boolean }) => ({ isLoading: false, data: enabled ? { photos: [], identities: [], listings: [] } : undefined }) }));
vi.mock("@/components/ui", () => ({
  Body: ({ children }: { children: React.ReactNode }) => React.createElement("body-text", null, children),
  Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => React.createElement("button", { title, onPress, disabled }, title),
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("card", null, children),
  Eyebrow: ({ children }: { children: React.ReactNode }) => React.createElement("eyebrow", null, children),
  Field: (props: Record<string, unknown>) => React.createElement("field", props),
  H1: ({ children }: { children: React.ReactNode }) => React.createElement("h1", null, children),
  H2: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
  Screen: ({ children }: { children: React.ReactNode }) => React.createElement("screen", null, children)
}));

import { AdminPhotoReviewCta, ADMIN_PHOTO_REVIEW_ROUTE } from "@/components/admin-photo-review-cta";
import { MobilePhotoModeration } from "@/components/photo-moderation";
import AdminPhotoReviewScreen from "../app/dashboard/moderation/photos";

const photo = {
  id: "photo-1", listingId: "listing-1", listingTitle: "Garden flat", submitterName: "Amina Owner",
  width: 1200, height: 800, submittedAt: "2026-08-21T10:05:00.000Z", contentUrl: "/api/moderation/photos/photo-1/content"
};

describe("mobile admin photo review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.loading = false;
    mocks.auth.session = { role: "ADMIN" };
    mocks.apiFetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/webp" } }));
    mocks.apiJson.mockResolvedValue({ id: "photo-1", moderationState: "APPROVED", listingState: "APPROVED" });
  });

  it("navigates from the admin dashboard to the real photo-review route", () => {
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<AdminPhotoReviewCta pending={2} />); });
    act(() => { screen!.root.findByType("button").props.onPress(); });
    expect(mocks.push).toHaveBeenCalledWith(ADMIN_PHOTO_REVIEW_ROUTE);
  });

  it("loads protected media and approves with reviewer notes through the shared endpoint", async () => {
    let screen: ReturnType<typeof create>;
    await act(async () => { screen = create(<MobilePhotoModeration initialPhotos={[photo]} />); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.apiFetch).toHaveBeenCalledWith(photo.contentUrl);
    const field = screen!.root.find(node => String(node.type) === "field");
    act(() => field.props.onChangeText("Clear interior"));
    const approve = screen!.root.findAllByType("button").find(button => button.props.title === "Approve")!;
    expect(approve.props.disabled).toBe(false);
    await act(async () => { await approve.props.onPress(); });
    expect(mocks.apiJson).toHaveBeenCalledWith("moderation/photos/photo-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ decision: "APPROVE", notes: "Clear interior" })
    }));
    expect(screen!.root.findAllByProps({ title: "Approve" })).toHaveLength(0);
  });

  it("blocks non-admin accounts at the screen boundary", () => {
    mocks.auth.session = { role: "LANDLORD" };
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<AdminPhotoReviewScreen />); });
    expect(screen!.root.findByType("h1").children.join("")).toBe("Admins only");
  });
});
