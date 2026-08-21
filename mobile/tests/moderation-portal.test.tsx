import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiJson: vi.fn(), alert: vi.fn() }));

vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert },
  Platform: { select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: { children: React.ReactNode }) => React.createElement("text", null, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement("view", null, children)
}));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: {} } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn(), apiJson: mocks.apiJson }));
vi.mock("@/components/ui", () => ({
  Body: ({ children }: { children: React.ReactNode }) => React.createElement("body-text", null, children),
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => React.createElement("button", { title, onPress }, title),
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("card", null, children),
  Field: (props: Record<string, unknown>) => React.createElement("field", props),
  H2: ({ children }: { children: React.ReactNode }) => React.createElement("heading", null, children)
}));

import { MobileModerationPortal } from "@/components/moderation-portal";

describe("mobile moderation portal", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.apiJson.mockResolvedValue({ state: "APPROVED" }); });

  it("lets an admin approve a pending landlord from the mobile queue", async () => {
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<MobileModerationPortal initialData={{
      listings: [], photos: [], identities: [{
        id: "verification-1", kind: "LANDLORD_IDENTITY", role: "LANDLORD",
        subjectName: "Amina Owner", submittedAt: "2026-08-21T08:00:00.000Z",
        documentUrl: "/api/moderation/identities/verification-1/document"
      }]
    }} />); });
    const approve = screen!.root.findAllByType("button").find((button) => button.props.title === "Approve")!;
    await act(async () => { await approve.props.onPress(); });
    expect(mocks.apiJson).toHaveBeenCalledWith("moderation/identities/verification-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ decision: "APPROVE", notes: "" })
    }));
    expect(screen!.root.findAllByProps({ title: "Approve" })).toHaveLength(0);
  });
});
