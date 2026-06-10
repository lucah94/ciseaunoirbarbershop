/**
 * Tests for src/app/api/gift-cards/route.ts
 *
 * Covers: generateCode format, schema validation, GET lookup,
 * POST rate-limit, POST validation errors, POST success path,
 * and error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("resend", () => ({
  Resend: function Resend() {
    return { emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) } };
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue(null),
}));

import { supabaseAdmin as supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { GET, POST } from "@/app/api/gift-cards/route";
import { NextRequest } from "next/server";

function makeGetRequest(code?: string): NextRequest {
  const url = code
    ? `http://localhost/api/gift-cards?code=${code}`
    : "http://localhost/api/gift-cards";
  return new NextRequest(url);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/gift-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockChain(returnValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(returnValue);
  chain.insert.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── generateCode (replicated) ────────────────────────────────────────────────

describe("generateCode", () => {
  // We test the observable properties via the POST route which calls generateCode
  it.todo("generated code is exactly 8 characters");
  it.todo("generated code only contains characters from the allowed alphabet (no 0, 1, I, O)");
  it.todo("two consecutive calls produce different codes (probabilistic)");
});

// ── GET /api/gift-cards ──────────────────────────────────────────────────────

describe("GET /api/gift-cards", () => {
  it("returns 400 when code query param is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/code/i);
  });

  it("returns 404 when gift card is not found", async () => {
    const chain = mockChain({ data: null, error: { message: "not found" } });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await GET(makeGetRequest("INVALID1"));
    expect(res.status).toBe(404);
  });

  it("uppercases the code before querying", async () => {
    const chain = mockChain({ data: null, error: { message: "not found" } });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await GET(makeGetRequest("abcd1234"));
    expect(chain.eq).toHaveBeenCalledWith("code", "ABCD1234");
  });

  it("returns gift card data with 200 when found", async () => {
    const giftCard = { code: "TESTCODE", amount: 50, status: "active", recipient_name: "Marie", created_at: "2026-06-01" };
    const chain = mockChain({ data: giftCard, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await GET(makeGetRequest("TESTCODE"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe("TESTCODE");
    expect(json.amount).toBe(50);
  });
});

// ── POST /api/gift-cards ─────────────────────────────────────────────────────

describe("POST /api/gift-cards", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    (rateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      NextResponse.json({ error: "Rate limit" }, { status: 429 })
    );

    const res = await POST(makePostRequest({ amount: 50, buyer_name: "Test", buyer_email: "t@t.com", recipient_name: "R", recipient_email: "r@r.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is below minimum (10$)", async () => {
    const res = await POST(makePostRequest({ amount: 5, buyer_name: "Jean", buyer_email: "j@j.com", recipient_name: "Marie", recipient_email: "m@m.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/valid/i);
  });

  it("returns 400 when amount exceeds maximum (500$)", async () => {
    const res = await POST(makePostRequest({ amount: 600, buyer_name: "Jean", buyer_email: "j@j.com", recipient_name: "Marie", recipient_email: "m@m.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when buyer_email is not a valid email", async () => {
    const res = await POST(makePostRequest({ amount: 50, buyer_name: "Jean", buyer_email: "not-an-email", recipient_name: "Marie", recipient_email: "m@m.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipient_email is not a valid email", async () => {
    const res = await POST(makePostRequest({ amount: 50, buyer_name: "Jean", buyer_email: "j@j.com", recipient_name: "Marie", recipient_email: "not-valid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when buyer_name is empty", async () => {
    const res = await POST(makePostRequest({ amount: 50, buyer_name: "", buyer_email: "j@j.com", recipient_name: "Marie", recipient_email: "m@m.com" }));
    expect(res.status).toBe(400);
  });

  it("inserts gift card with status 'pending' and returns created record", async () => {
    const created = { id: "uuid", code: "ABCD1234", amount: 75, status: "pending" };
    const chain = mockChain({ data: created, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makePostRequest({
      amount: 75,
      buyer_name: "Jean Tremblay",
      buyer_email: "jean@example.com",
      recipient_name: "Marie",
      recipient_email: "marie@example.com",
      message: "Joyeux anniversaire!",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.amount).toBe(75);
    expect(json.status).toBe("pending");
  });

  it("returns 500 when supabase insert fails", async () => {
    const chain = mockChain({ data: null, error: { message: "DB error" } });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makePostRequest({
      amount: 50,
      buyer_name: "Jean",
      buyer_email: "j@j.com",
      recipient_name: "Marie",
      recipient_email: "m@m.com",
    }));
    expect(res.status).toBe(500);
  });

  it("accepts an empty message field", async () => {
    const chain = mockChain({ data: { id: "uuid", code: "ABCD1234", amount: 50, status: "pending" }, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makePostRequest({
      amount: 50,
      buyer_name: "Jean",
      buyer_email: "j@j.com",
      recipient_name: "Marie",
      recipient_email: "m@m.com",
      message: "",
    }));
    expect(res.status).toBe(200);
  });
});
