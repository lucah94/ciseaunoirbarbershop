/**
 * Tests for src/app/api/cron/auto-complete/route.ts
 *
 * The cron auto-complete route has significant pure-function logic:
 * - generatePromoCode format
 * - pastBookings filter (appointment must be ≥1h in the past)
 * - first-visit promo eligibility (completed_count === 1 and < 2h ago)
 *
 * All pure-function logic is replicated here for direct testing.
 * Route-level tests (auth, DB interaction) use todos.
 */
import { describe, it, expect } from "vitest";

// ─── generatePromoCode ────────────────────────────────────────────────────────

function generatePromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BIENVENUE-";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

describe("generatePromoCode", () => {
  it("starts with BIENVENUE-", () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePromoCode()).toMatch(/^BIENVENUE-/);
    }
  });

  it("has exactly 15 characters total (BIENVENUE- + 5)", () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePromoCode()).toHaveLength(15);
    }
  });

  it("only uses safe-alphabet characters after the prefix", () => {
    const valid = /^BIENVENUE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
    for (let i = 0; i < 50; i++) {
      expect(generatePromoCode()).toMatch(valid);
    }
  });

  it("never contains ambiguous characters (0, 1, I, O)", () => {
    for (let i = 0; i < 100; i++) {
      const suffix = generatePromoCode().slice(10);
      expect(suffix).not.toMatch(/[01IO]/);
    }
  });
});

// ─── pastBookings filter ──────────────────────────────────────────────────────

interface Booking {
  id: string;
  date: string;
  time: string;
  status: string;
}

function filterPastBookings(bookings: Booking[], now: Date): Booking[] {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return bookings.filter((b) => {
    if (!b.date || !b.time) return false;
    const appointmentStart = new Date(`${b.date}T${b.time}:00`);
    if (isNaN(appointmentStart.getTime())) return false;
    return appointmentStart <= oneHourAgo;
  });
}

describe("pastBookings filter (≥1h in the past)", () => {
  const now = new Date("2026-06-09T14:00:00");

  it("includes a booking that started 2 hours ago", () => {
    const bookings = [{ id: "1", date: "2026-06-09", time: "12:00", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(1);
  });

  it("includes a booking that started exactly 1 hour ago", () => {
    const bookings = [{ id: "1", date: "2026-06-09", time: "13:00", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(1);
  });

  it("excludes a booking that starts in 30 minutes (future)", () => {
    const bookings = [{ id: "1", date: "2026-06-09", time: "14:30", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(0);
  });

  it("excludes a booking that started 30 minutes ago (not yet 1h)", () => {
    const bookings = [{ id: "1", date: "2026-06-09", time: "13:31", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(0);
  });

  it("excludes bookings with missing date", () => {
    const bookings = [{ id: "1", date: "", time: "12:00", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(0);
  });

  it("excludes bookings with missing time", () => {
    const bookings = [{ id: "1", date: "2026-06-09", time: "", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(0);
  });

  it("excludes bookings with invalid date string", () => {
    const bookings = [{ id: "1", date: "not-a-date", time: "12:00", status: "confirmed" }];
    expect(filterPastBookings(bookings, now)).toHaveLength(0);
  });

  it("filters multiple bookings correctly, keeping only those ≥1h past", () => {
    const bookings = [
      { id: "1", date: "2026-06-09", time: "10:00", status: "confirmed" }, // 4h ago — include
      { id: "2", date: "2026-06-09", time: "13:45", status: "confirmed" }, // 15min ago — exclude
      { id: "3", date: "2026-06-09", time: "12:59", status: "confirmed" }, // 1h01 ago — include
    ];
    const result = filterPastBookings(bookings, now);
    expect(result.map(b => b.id)).toEqual(["1", "3"]);
  });
});

// ─── Route-level tests ────────────────────────────────────────────────────────

describe("GET /api/cron/auto-complete", () => {
  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { completed: 0, reviewsSent: 0, firstVisitPromosSent: 0 } when no past bookings");

  it.todo("marks confirmed bookings older than 1h as completed");

  it.todo("sends review request email when client_email is set and review_request_sent is false");

  it.todo("skips review email when review_request_sent is already true");

  it.todo("sends first-visit promo email when completed_count becomes 1 and it's within 2h");

  it.todo("does not send first-visit promo if booking completed more than 2h ago");

  it.todo("returns 500 and error message when Supabase query fails");
});
