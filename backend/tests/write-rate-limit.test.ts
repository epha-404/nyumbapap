import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/request-security", () => ({ clientIpHash: () => "ip-hash", consumeRateLimit }));

import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

describe("write endpoint rate limiting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a retryable 429 after the application limit is exceeded", async () => {
    consumeRateLimit.mockResolvedValue({ limited: true, retryAfter: 42 });
    const response = await enforceWriteRateLimit(new Request("http://localhost/write"), "write", "user-1", 3);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("42");
    expect(consumeRateLimit).toHaveBeenCalledWith("write", "user-1:ip-hash", 3, 60);
  });
});
