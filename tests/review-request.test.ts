/**
 * Tests for src/app/api/review-request/route.ts
 *
 * Covers:
 * - Returns 200 { ok: true } even when client_email is missing (silent success)
 * - Calls sendReviewRequestEmail with correct params when email is provided
 * - Returns 200 { ok: true } after successful email send
 * - Returns 500 when sendReviewRequestEmail throws
 * - Missing body fields: client_name/barber/service are optional
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendReviewRequestEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendReviewRequestEmail } from "@/lib/email";

function makeRequest(body: object) {
  return new Request("http://localhost/api/review-request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/review-request", () => {
  it("returns 200 { ok: true } when client_email is missing (silent no-op)", async () => {
    const { POST } = await import("@/app/api/review-request/route");
    const res = await POST(makeRequest({ client_name: "Alice" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
  });

  it("calls sendReviewRequestEmail with correct params when email is present", async () => {
    const { POST } = await import("@/app/api/review-request/route");
    await POST(makeRequest({
      client_name: "Bob",
      client_email: "bob@example.com",
      barber: "Melynda",
      service: "Coupe",
    }) as never);
    expect(sendReviewRequestEmail).toHaveBeenCalledWith({
      client_name: "Bob",
      client_email: "bob@example.com",
      barber: "Melynda",
      service: "Coupe",
    });
  });

  it("returns 200 { ok: true } after successful email send", async () => {
    const { POST } = await import("@/app/api/review-request/route");
    const res = await POST(makeRequest({ client_email: "alice@test.com" }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 500 when sendReviewRequestEmail throws", async () => {
    vi.mocked(sendReviewRequestEmail).mockRejectedValueOnce(new Error("email error"));
    const { POST } = await import("@/app/api/review-request/route");
    const res = await POST(makeRequest({ client_email: "fail@test.com" }) as never);
    expect(res.status).toBe(500);
  });

  it.todo("handles null client_email the same as missing (silent no-op)");
  it.todo("handles malformed JSON body gracefully");
});
