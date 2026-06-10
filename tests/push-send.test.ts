/**
 * Tests for src/app/api/push/send/route.ts
 *
 * Covers:
 * - Returns 400 for malformed JSON
 * - Returns 400 when email, title, or body is missing
 * - Returns 404 when no subscriptions found for email
 * - Returns 200 with dry-run info when subscriptions found
 * - Returns 500 when Supabase query fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/lib/supabase";

const mockSub = { id: "sub-1", endpoint: "https://fcm.example.com/abc", p256dh: "k", auth: "a", client_email: "jean@example.com" };

function selectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data, error }),
  };
}

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/push/send — validation", () => {
  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/push/send/route");
    const req = new NextRequest("http://localhost/api/push/send", {
      method: "POST",
      body: "bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ title: "Hello", body: "World" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "a@b.com", body: "World" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "a@b.com", title: "Hello" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/push/send — lookup", () => {
  it("returns 404 when no subscriptions found for email", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(selectChain([]) as never);
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "nobody@example.com", title: "T", body: "B" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 with subscriptions_found and would_send on success (dry-run)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(selectChain([mockSub]) as never);
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "jean@example.com", title: "RDV", body: "Demain 10h", url: "/rdv" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.subscriptions_found).toBe(1);
    expect(json.would_send).toMatchObject({ title: "RDV", body: "Demain 10h", url: "/rdv" });
  });

  it("defaults url to '/' when not provided", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(selectChain([mockSub]) as never);
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "jean@example.com", title: "T", body: "B" }));
    const json = await res.json();
    expect(json.would_send.url).toBe("/");
  });

  it("returns 500 when Supabase query fails", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(selectChain(null, { message: "DB error" }) as never);
    const { POST } = await import("@/app/api/push/send/route");
    const res = await POST(makePost({ email: "jean@example.com", title: "T", body: "B" }));
    expect(res.status).toBe(500);
  });
});
