import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredNotificationChannels } from "@/modules/notifications/channels";

describe("lifecycle notification channel registration", () => {
  const original = process.env.AFRICASTALKING_API_KEY;
  afterEach(() => { if (original === undefined) delete process.env.AFRICASTALKING_API_KEY; else process.env.AFRICASTALKING_API_KEY = original; });

  it("never instantiates the SMS channel when the API key is unset", () => {
    delete process.env.AFRICASTALKING_API_KEY;
    const sms = vi.fn(() => ({ type: "SMS" as const, sendAvailabilityCheck: vi.fn() }));
    const emailChannel = { type: "EMAIL" as const, sendAvailabilityCheck: vi.fn() };
    expect(configuredNotificationChannels({ email: () => emailChannel, sms })).toEqual([emailChannel]);
    expect(sms).not.toHaveBeenCalled();
    expect(emailChannel.sendAvailabilityCheck).not.toHaveBeenCalled();
  });
});
