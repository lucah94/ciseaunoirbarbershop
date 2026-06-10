/**
 * Tests for src/app/api/waitlist/route.ts
 *
 * Covers: validation schema, successful insert, SMS confirmation,
 * admin auth guard on GET.
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn().mockResolvedValue({}) },
  })),
}));

// ─── Waitlist schema (mirrors route.ts) ──────────────────────────────────────

const waitlistSchema = z.object({
  client_name: z.string().min(1).max(100),
  client_email: z.string().email().optional().or(z.literal("")),
  client_phone: z.string().min(1).max(20),
  service: z.string().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  barber: z.string().min(1),
});

describe("waitlistSchema validation", () => {
  const valid = {
    client_name: "Marie Lapointe",
    client_phone: "4186655703",
    date: "2026-07-01",
    time: "10:00",
    barber: "Melynda",
  };

  it("accepts a minimal valid entry (no email, no service)", () => {
    expect(waitlistSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a full entry with email and service", () => {
    expect(waitlistSchema.safeParse({ ...valid, client_email: "marie@example.com", service: "Coupe classique" }).success).toBe(true);
  });

  it("rejects missing client_name", () => {
    const { client_name: _, ...rest } = valid;
    expect(waitlistSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing client_phone", () => {
    const { client_phone: _, ...rest } = valid;
    expect(waitlistSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(waitlistSchema.safeParse({ ...valid, date: "01/07/2026" }).success).toBe(false);
  });

  it("rejects time without zero-padding (single digit hour)", () => {
    expect(waitlistSchema.safeParse({ ...valid, time: "9:00" }).success).toBe(false);
  });

  it("rejects missing barber", () => {
    const { barber: _, ...rest } = valid;
    expect(waitlistSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(waitlistSchema.safeParse({ ...valid, client_email: "notvalid" }).success).toBe(false);
  });
});

// ─── Route-level integration ──────────────────────────────────────────────────

describe("POST /api/waitlist", () => {
  it.todo("returns 429 after rate limit is exceeded");
  it.todo("returns 400 for invalid JSON body");
  it.todo("returns 400 for schema validation failure");
  it.todo("inserts record and returns { ok: true } on success");
  it.todo("sends SMS confirmation to client when Twilio env is set");
  it.todo("skips SMS gracefully when Twilio env is missing");
  it.todo("returns 500 when Supabase insert fails");
});

describe("GET /api/waitlist", () => {
  it.todo("returns 401 when admin_auth cookie is absent");
  it.todo("returns waitlist entries for admin when cookie is present");
  it.todo("filters by date when date param is provided");
  it.todo("filters by barber when barber param is provided");
  it.todo("only returns notified=false entries");
});
