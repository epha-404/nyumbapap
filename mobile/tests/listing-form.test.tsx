import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiJson: vi.fn(), invalidateQueries: vi.fn() }));

vi.mock("react-native", () => ({
  Platform: { select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (value: unknown) => value },
  Switch: (props: Record<string, unknown>) => React.createElement("switch", props),
  Text: ({ children }: { children: React.ReactNode }) => React.createElement("text", null, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement("view", null, children)
}));
vi.mock("react-native-maps", () => ({
  default: (props: { children?: React.ReactNode }) => React.createElement("map", null, props.children),
  Marker: () => React.createElement("marker")
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }) }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "12345678-1234-4234-9234-123456789012" }));
vi.mock("@/lib/api", () => ({ apiJson: mocks.apiJson }));
vi.mock("@/components/ui", () => ({
  Body: ({ children }: { children: React.ReactNode }) => React.createElement("body-text", null, children),
  Button: (props: Record<string, unknown> & { title: string }) => React.createElement("button", props, props.title),
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("card", null, children),
  ErrorText: ({ message }: { message: string }) => React.createElement("error-text", null, message),
  Field: (props: Record<string, unknown>) => React.createElement("field", props),
  H2: ({ children }: { children: React.ReactNode }) => React.createElement("heading", null, children)
}));

import { ListingForm } from "@/components/listing-form";

describe("mobile listing form", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.apiJson.mockResolvedValue({ id: "listing-created" }); });

  it("creates a listing from a confirmed map pin without requiring an exact-address string", async () => {
    const onCreated = vi.fn();
    let screen: ReturnType<typeof create>;
    act(() => { screen = create(<ListingForm onCreated={onCreated} />); });
    const fields = screen!.root.findAllByType("field" as never);
    const enter = (label: string, value: string) => act(() => fields.find(field => field.props.label === label)!.props.onChangeText(value));
    enter("Listing title", "Bright Nyangati apartment");
    enter("Description", "A bright apartment close to transport, shops and local schools.");
    enter("Owner contact", "0712345678");
    enter("Monthly rent (KES)", "18000");

    expect(fields.some(field => field.props.label === "Exact address")).toBe(false);
    expect(fields.some(field => field.props.label === "Nearest landmark or building name (optional)")).toBe(true);
    act(() => screen!.root.findByType("switch" as never).props.onValueChange(true));
    const submit = screen!.root.findAllByType("button" as never).find(button => button.props.title === "Submit for review")!;
    await act(async () => { await submit.props.onPress(); });

    expect(mocks.apiJson).toHaveBeenCalledWith("dashboard/listings", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "idempotency-key": "12345678-1234-4234-9234-123456789012" }),
      body: expect.stringContaining('"locationConfirmed":"true"')
    }));
    expect(onCreated).toHaveBeenCalledWith("listing-created");
  });
});
