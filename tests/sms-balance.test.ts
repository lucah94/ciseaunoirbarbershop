/**
 * Tests for src/app/api/sms/balance/route.ts
 *
 * Covers:
 * - Returns { balance: float, currency: string } on success
 * - Returns 500 with error string when Twilio throws
 * - Uses TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    api: {
      v2010: {
        accounts: vi.fn(() => ({
          balance: { fetch: vi.fn().mockResolvedValue({ balance: "12.50", currency: "USD" }) },
        })),
      },
    },
  })),
}));

import twilio from "twilio";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
});

describe("GET /api/sms/balance", () => {
  it("returns { balance, currency } on success", async () => {
    const { GET } = await import("@/app/api/sms/balance/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ balance: 12.5, currency: "USD" });
  });

  it("balance is a float (not a string)", async () => {
    const { GET } = await import("@/app/api/sms/balance/route");
    const res = await GET();
    const json = await res.json();
    expect(typeof json.balance).toBe("number");
  });

  it("returns 500 with error string when Twilio client throws", async () => {
    vi.mocked(twilio).mockReturnValueOnce({
      api: { v2010: { accounts: vi.fn(() => ({ balance: { fetch: vi.fn().mockRejectedValue(new Error("auth error")) } })) } },
    } as never);
    const { GET } = await import("@/app/api/sms/balance/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("auth error");
  });
});
