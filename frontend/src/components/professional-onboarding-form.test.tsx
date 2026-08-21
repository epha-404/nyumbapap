import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalOnboardingForm } from "./professional-onboarding-form";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), csrfFetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/api", () => ({ csrfFetch: mocks.csrfFetch }));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("professional onboarding document upload", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("enables document selection after saving details and surfaces upload success", async () => {
    mocks.csrfFetch
      .mockResolvedValueOnce(jsonResponse({ onboarding: { role: "LANDLORD", name: "Amina", verificationState: "PENDING", hasCredential: true } }))
      .mockResolvedValueOnce(jsonResponse({ message: "Document submitted for verification" }, 201));
    render(<ProfessionalOnboardingForm onboarding={{ role: "LANDLORD", name: "Amina", verificationState: "NOT_SUBMITTED", hasCredential: false }} />);

    const fileInput = screen.getByLabelText("National ID or passport image") as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("National ID or passport number"), { target: { value: "ID12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit onboarding" }));
    await waitFor(() => expect(fileInput.disabled).toBe(false));
    expect((screen.getByLabelText("National ID or passport number") as HTMLInputElement).value).toBe("ID12345");

    const file = new File([new Uint8Array([137, 80, 78, 71])], "identity.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText("Selected: identity.png")).toBeTruthy();
    const uploadButton = screen.getByRole("button", { name: "Submit verification document" });
    fireEvent.submit(uploadButton.closest("form")!);
    await screen.findByText("Document submitted for verification");
    expect(mocks.csrfFetch).toHaveBeenNthCalledWith(2, "onboarding/document", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
  });

  it("lets a landlord explicitly continue in the unverified tier", async () => {
    mocks.csrfFetch.mockResolvedValueOnce(jsonResponse({ onboarding: { role: "LANDLORD", name: "Amina", verificationState: "UNVERIFIED", hasCredential: true } }));
    render(<ProfessionalOnboardingForm onboarding={{ role: "LANDLORD", name: "Amina", verificationState: "REJECTED", hasCredential: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue without ID verification" }));
    await screen.findByRole("button", { name: "Unverified tier selected" });
    expect(mocks.csrfFetch).toHaveBeenCalledWith("onboarding/decline-document", { method: "POST" });
  });

  it("shows an approved landlord as a compact read-only verified state", () => {
    render(<ProfessionalOnboardingForm onboarding={{ role: "LANDLORD", name: "Amina", verificationState: "APPROVED", hasCredential: true }} />);
    expect(screen.getByLabelText("Verified")).toBeTruthy();
    expect(screen.getByText("Amina")).toBeTruthy();
    expect(screen.queryByLabelText("National ID or passport number")).toBeNull();
    expect(screen.queryByRole("button", { name: "Resubmit details" })).toBeNull();
    expect(screen.queryByText("Submit verification document")).toBeNull();
  });
});
