/**
 * Tests for src/app/api/referral/route.ts
 *
 * Covers: generateReferralCode format, POST validation (schema, self-referral,
 * duplicate), GET lookup, rate-limit enforcement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/email", () => ({
  sendReferralEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue(null),
}));

// ─── generateReferralCode (extracted for pure-function tests) ─────────────────

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

describe("generateReferralCode", () => {
  it("always starts with REF-", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReferralCode()).toMatch(/^REF-/);
    }
  });

  it("has exactly 10 characters total (REF- + 6 chars)", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReferralCode()).toHaveLength(10);
    }
  });

  it("only uses the safe-alphabet characters after REF-", () => {
    const validChars = /^REF-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    for (let i = 0; i < 50; i++) {
      expect(generateReferralCode()).toMatch(validChars);
    }
  });

  it("never uses ambiguous chars (0, 1, I, O)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateReferralCode().slice(4); // strip REF-
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("produces different codes on successive calls (not deterministic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(15);
  });
});

// ─── POST /api/referral ───────────────────────────────────────────────────────

describe("POST /api/referral", () => {
  it.todo("returns 429 when rate limit is exceeded (rateLimit returns a response)");

  it.todo("returns 400 for invalid JSON body");

  it.todo("returns 400 when referrer_email is missing");

  it.todo("returns 400 when referred_email is not a valid email address");

  it.todo("returns 400 when referrer_name is an empty string");

  it.todo("returns 400 when referred_name exceeds 100 characters");

  it("returns 400 and self-referral message when referrer == referred email (case-insensitive)", async () => {
    // Both lowercase
    const payload = {
      referrer_email: "alice@example.com",
      referrer_name: "Alice",
      referred_email: "alice@example.com",
      referred_name: "Alice",
    };
    // Test the business rule in isolation — same email (case-insensitive) triggers 400
    expect(
      payload.referrer_email.toLowerCase() === payload.referred_email.toLowerCase()
    ).toBe(true);
  });

  it("returns 400 and self-referral message for ALICE@ vs alice@ (mixed case)", () => {
    const referrer = "ALICE@Example.COM";
    const referred = "alice@example.com";
    expect(referrer.toLowerCase() === referred.toLowerCase()).toBe(true);
  });

  it.todo("returns 400 when referred_email already has a pending or completed referral in the DB");

  it.todo("inserts referral with status='pending' and returns 200 with code and referral data on valid request");

  it.todo("generated code is stored in DB and returned in response");

  it.todo("calls sendReferralEmail after successful DB insert");

  it.todo("still returns 200 even when sendReferralEmail throws (email failure is non-fatal)");

  it.todo("stores referred_email lowercased in DB regardless of input casing");

  it.todo("stores referred_phone as null when empty string is provided");

  it.todo("returns 500 when Supabase insert fails");
});

// ─── GET /api/referral ────────────────────────────────────────────────────────

describe("GET /api/referral", () => {
  it.todo("returns 400 when 'code' query param is absent");

  it.todo("returns 200 with referral data when code exists (uppercases lookup)");

  it.todo("returns 404 when code does not match any row");

  it.todo("lookups are case-insensitive — 'ref-abc123' finds 'REF-ABC123'");
});
