/**
 * Tests for src/app/api/push/subscribe/route.ts
 *
 * Covers:
 * - Returns 400 for invalid JSON body
 * - Returns 400 when Zod validation fails (missing endpoint, keys)
 * - Returns 400 when endpoint is not a valid URL
 * - Returns 200 and { ok: true, id } on valid subscription
 * - Upserts by endpoint (same endpoint → updates, doesn't duplicate)
 * - Stores client_email as null when empty string provided
 * - Returns 500 when Supabase upsert fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/lib/supabase";

const validSubscription = {
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "key1abc", auth: "authkey1" },
  },
  client_email: "jean@example.com",
};

function upsertChain(data: unknown, error: unknown = null) {
  return {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/push/subscribe — validation", () => {
  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when subscription.endpoint is missing", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const res = await POST(makePost({ subscription: { keys: { p256dh: "k", auth: "a" } } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when endpoint is not a valid URL", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const body = { ...validSubscription, subscription: { ...validSubscription.subscription, endpoint: "not-a-url" } };
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toContain("Endpoint invalide");
  });

  it("returns 400 when p256dh key is empty", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const body = { ...validSubscription, subscription: { ...validSubscription.subscription, keys: { p256dh: "", auth: "a" } } };
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when auth key is empty", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const body = { ...validSubscription, subscription: { ...validSubscription.subscription, keys: { p256dh: "k", auth: "" } } };
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/push/subscribe — success", () => {
  it("returns 200 with { ok: true, id } on valid body", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(upsertChain({ id: "sub-123" }) as never);
    const { POST } = await import("@/app/api/push/subscribe/route");
    const res = await POST(makePost(validSubscription));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("sub-123");
  });

  it("accepts subscription without client_email (optional field)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(upsertChain({ id: "sub-456" }) as never);
    const { POST } = await import("@/app/api/push/subscribe/route");
    const { client_email: _omit, ...bodyWithoutEmail } = validSubscription;
    const res = await POST(makePost(bodyWithoutEmail));
    expect(res.status).toBe(200);
  });

  it("stores null for client_email when empty string provided", async () => {
    const upsertMock = upsertChain({ id: "sub-789" });
    vi.mocked(supabaseAdmin.from).mockReturnValue(upsertMock as never);
    const { POST } = await import("@/app/api/push/subscribe/route");
    await POST(makePost({ ...validSubscription, client_email: "" }));
    expect(upsertMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_email: null }),
      expect.anything()
    );
  });

  it("upserts on conflict of endpoint column", async () => {
    const upsertMock = upsertChain({ id: "sub-123" });
    vi.mocked(supabaseAdmin.from).mockReturnValue(upsertMock as never);
    const { POST } = await import("@/app/api/push/subscribe/route");
    await POST(makePost(validSubscription));
    expect(upsertMock.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: "endpoint" })
    );
  });
});

describe("POST /api/push/subscribe — Supabase error", () => {
  it("returns 500 when Supabase upsert fails", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(upsertChain(null, { message: "DB error" }) as never);
    const { POST } = await import("@/app/api/push/subscribe/route");
    const res = await POST(makePost(validSubscription));
    expect(res.status).toBe(500);
  });
});
