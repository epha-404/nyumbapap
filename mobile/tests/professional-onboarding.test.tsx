import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiJson: vi.fn(),
  invalidateQueries: vi.fn(),
  onboarding: { role: "LANDLORD", name: "Amina", verificationState: "REJECTED", hasCredential: true }
}));

vi.mock("react-native", () => ({}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: () => ({ isLoading: false, error: null, data: { onboarding: mocks.onboarding } })
}));
vi.mock("@/lib/api", () => ({ apiJson: mocks.apiJson, apiMultipart: vi.fn() }));
vi.mock("@/components/ui", () => ({
  Body: ({ children }: { children: React.ReactNode }) => React.createElement("body-text", null, children),
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => React.createElement("button", { title, onPress }, title),
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("card", null, children),
  ErrorText: ({ message }: { message: string }) => React.createElement("error-text", null, message),
  Field: (props: { label: string; value: string; onChangeText: (value: string) => void }) => React.createElement("field", props),
  H2: ({ children }: { children: React.ReactNode }) => React.createElement("heading", null, children)
}));

import { ProfessionalOnboarding } from "@/components/professional-onboarding";

describe("mobile professional onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.onboarding, { role: "LANDLORD", name: "Amina", verificationState: "REJECTED", hasCredential: true });
    mocks.apiJson.mockResolvedValue({ onboarding: { role: "LANDLORD", name: "Amina", verificationState: "PENDING", hasCredential: true } });
  });

  it("keeps the locally entered ID after the real resubmit success handler runs", async () => {
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<ProfessionalOnboarding />); });
    const credential = screen!.root.findAllByType("field" as never).find(field => field.props.label === "National ID or passport number")!;
    act(() => credential.props.onChangeText("ID-9081726"));
    const submit = screen!.root.findAllByType("button").find(button => button.props.title === "Resubmit details")!;
    await act(async () => { await submit.props.onPress(); });
    const currentCredential = screen!.root.findAllByType("field" as never).find(field => field.props.label === "National ID or passport number")!;
    expect(currentCredential.props.value).toBe("ID-9081726");
    expect(mocks.apiJson).toHaveBeenCalledWith("onboarding", expect.objectContaining({ body: expect.stringContaining("ID-9081726") }));
  });

  it("persists the landlord's explicit unverified-tier choice", async () => {
    mocks.apiJson.mockResolvedValueOnce({ onboarding: { role: "LANDLORD", name: "Amina", verificationState: "UNVERIFIED", hasCredential: true } });
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<ProfessionalOnboarding />); });
    const decline = screen!.root.findAllByType("button").find(button => button.props.title === "Continue without ID verification")!;
    await act(async () => { await decline.props.onPress(); });
    expect(mocks.apiJson).toHaveBeenCalledWith("onboarding/decline-document", { method: "POST" });
  });

  it("shows approved verification without editable or upload controls", () => {
    Object.assign(mocks.onboarding, { verificationState: "APPROVED" });
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<ProfessionalOnboarding />); });
    expect(screen!.root.findAllByType("field" as never)).toHaveLength(0);
    expect(screen!.root.findAllByType("button" as never)).toHaveLength(0);
    expect(screen!.root.findAllByType("body-text" as never).map(node => node.children.join(" "))).toContain("✓ Verified");
  });
});
