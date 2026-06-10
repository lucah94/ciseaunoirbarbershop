/**
 * Tests for the Zod validation schema in src/app/api/bookings/route.ts.
 *
 * The schema is not exported, so these tests exercise it via the POST handler.
 * All Supabase calls are mocked to short-circuit after validation passes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Fluent mock that resolves to empty array at any point in the chain
function makeFluentQuery(result = { data: [], error: null }) {
  const q: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "not", "is", "order", "range", "single", "gte", "lte", "in", "limit"];
  for (const m of methods) {
    q[m] = vi.fn(() => Promise.resolve(result).then ? { ...q, then: undefined } : q);
  }
  // Make the query awaitable at any point
  Object.defineProperty(q, Symbol.toStringTag, { value: "Promise" });
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock("@/lib/supabase", () => {
  const fluentChain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "not", "is", "order", "range", "gte", "lte", "in", "limit", "single", "maybeSingle"];
  for (const m of methods) {
    fluentChain[m] = vi.fn(() => fluentChain);
  }
  fluentChain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);

  const insertChain: Record<string, unknown> = {};
  insertChain.select = vi.fn(() => insertChain);
  insertChain.single = vi.fn(() => Promise.resolve({ data: { id: "uuid-1" }, error: null }));
  insertChain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [{ id: "uuid-1" }], error: null }).then(resolve);

  const upsertChain = { ...insertChain };

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === "bookings" || table === "barber_blocks" || table === "clients" || table === "waitlist") {
          return { ...fluentChain, insert: vi.fn(() => insertChain), upsert: vi.fn(() => upsertChain) };
        }
        return { ...fluentChain, insert: vi.fn(() => insertChain) };
      }),
    },
  };
});
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationAdmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendBookingConfirmationSMS: vi.fn().mockResolvedValue(undefined),
  sendBarberNotificationSMS: vi.fn().mockResolvedValue(undefined),
  formatPhone: vi.fn((p: string) => p),
}));
vi.mock("@/lib/telegram", () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
  notifyBookingCancelled: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("twilio", () => ({ default: vi.fn(() => ({ messages: { create: vi.fn() } })) }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));
vi.mock("@/lib/conversions", () => ({ trackBookingConversion: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockReturnValue(null) }));

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  client_name: "Marie Tremblay",
  service: "Coupe classique",
  barber: "Melynda",
  date: "2026-07-15",
  time: "10:00",
};

describe("POST /api/bookings — Zod schema validation", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    ({ POST } = await import("@/app/api/bookings/route"));
  });

  // ── client_name ─────────────────────────────────────────────────────────────

  it("returns 400 when client_name is empty string", async () => {
    const res = await POST(makePost({ ...validBody, client_name: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Validation");
  });

  it("returns 400 when client_name exceeds 100 characters", async () => {
    const res = await POST(makePost({ ...validBody, client_name: "a".repeat(101) }));
    expect(res.status).toBe(400);
  });

  it("accepts client_name at exactly 100 characters", async () => {
    const res = await POST(makePost({ ...validBody, client_name: "a".repeat(100) }));
    expect(res.status).not.toBe(400);
  });

  // ── client_email ─────────────────────────────────────────────────────────────

  it("returns 400 when client_email is a non-email string", async () => {
    const res = await POST(makePost({ ...validBody, client_email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("accepts client_email as an empty string (optional)", async () => {
    const res = await POST(makePost({ ...validBody, client_email: "" }));
    expect(res.status).not.toBe(400);
  });

  it("accepts a valid email", async () => {
    const res = await POST(makePost({ ...validBody, client_email: "marie@example.com" }));
    expect(res.status).not.toBe(400);
  });

  // ── barber enum ───────────────────────────────────────────────────────────────

  it("returns 400 when barber is not Melynda or Stéphanie", async () => {
    const res = await POST(makePost({ ...validBody, barber: "Unknown" }));
    expect(res.status).toBe(400);
  });

  it("accepts Stéphanie as barber", async () => {
    const res = await POST(makePost({ ...validBody, barber: "Stéphanie" }));
    expect(res.status).not.toBe(400);
  });

  // ── date format ───────────────────────────────────────────────────────────────

  it("returns 400 when date is in MM/DD/YYYY format", async () => {
    const res = await POST(makePost({ ...validBody, date: "07/15/2026" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date has letters", async () => {
    const res = await POST(makePost({ ...validBody, date: "2026-July-15" }));
    expect(res.status).toBe(400);
  });

  it("accepts ISO date YYYY-MM-DD", async () => {
    const res = await POST(makePost({ ...validBody, date: "2026-12-31" }));
    expect(res.status).not.toBe(400);
  });

  // ── time format ───────────────────────────────────────────────────────────────

  it("returns 400 when time uses 12h format (10:00am)", async () => {
    const res = await POST(makePost({ ...validBody, time: "10:00am" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when minutes are out of range (10:60)", async () => {
    const res = await POST(makePost({ ...validBody, time: "10:60" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hour is out of range (25:00)", async () => {
    const res = await POST(makePost({ ...validBody, time: "25:00" }));
    expect(res.status).toBe(400);
  });

  it("accepts single-digit hour (9:00)", async () => {
    const res = await POST(makePost({ ...validBody, time: "9:00" }));
    expect(res.status).not.toBe(400);
  });

  // ── note length ───────────────────────────────────────────────────────────────

  it("returns 400 when note exceeds 500 characters", async () => {
    const res = await POST(makePost({ ...validBody, note: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("accepts note at exactly 500 characters", async () => {
    const res = await POST(makePost({ ...validBody, note: "a".repeat(500) }));
    expect(res.status).not.toBe(400);
  });

  // ── status enum ───────────────────────────────────────────────────────────────

  it("returns 400 when status is not a valid enum value", async () => {
    const res = await POST(makePost({ ...validBody, status: "pending" }));
    expect(res.status).toBe(400);
  });

  it("accepts status 'no_show'", async () => {
    const res = await POST(makePost({ ...validBody, status: "no_show" }));
    expect(res.status).not.toBe(400);
  });

  // ── missing required fields ───────────────────────────────────────────────────

  it("returns 400 when service is missing", async () => {
    const { service: _s, ...rest } = validBody;
    const res = await POST(makePost(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is missing", async () => {
    const { date: _d, ...rest } = validBody;
    const res = await POST(makePost(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty JSON object", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
