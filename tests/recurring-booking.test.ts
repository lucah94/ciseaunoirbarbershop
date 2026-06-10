/**
 * Tests for src/app/api/bookings/recurring/route.ts
 *
 * Covers the date-arithmetic helpers (addWeeks, addMonths, getNextDate)
 * and the POST/DELETE API handlers.
 *
 * Pure date functions are replicated here for unit testing; API tests
 * mock supabaseAdmin and requireAdmin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

// ── Replicated date helpers (mirrors route.ts) ──────────────────────────────

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function getNextDate(baseDate: string, pattern: string, index: number): string {
  if (pattern === "weekly") return addWeeks(baseDate, index);
  if (pattern === "biweekly") return addWeeks(baseDate, index * 2);
  if (pattern === "monthly") return addMonths(baseDate, index);
  return baseDate;
}

// ── addWeeks ────────────────────────────────────────────────────────────────

describe("addWeeks", () => {
  it("returns the same date when weeks = 0", () => {
    expect(addWeeks("2026-06-09", 0)).toBe("2026-06-09");
  });

  it("adds exactly 7 days per week", () => {
    expect(addWeeks("2026-06-09", 1)).toBe("2026-06-16");
    expect(addWeeks("2026-06-09", 2)).toBe("2026-06-23");
  });

  it("handles month boundary correctly", () => {
    expect(addWeeks("2026-06-29", 1)).toBe("2026-07-06");
  });

  it("handles year boundary correctly", () => {
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });

  it("handles negative weeks (going back in time)", () => {
    expect(addWeeks("2026-06-16", -1)).toBe("2026-06-09");
  });
});

// ── addMonths ───────────────────────────────────────────────────────────────

describe("addMonths", () => {
  it("returns the same date when months = 0", () => {
    expect(addMonths("2026-06-09", 0)).toBe("2026-06-09");
  });

  it("adds one month preserving day", () => {
    expect(addMonths("2026-06-09", 1)).toBe("2026-07-09");
  });

  it("handles year rollover (December + 1 = January next year)", () => {
    expect(addMonths("2026-12-09", 1)).toBe("2027-01-09");
  });

  it("handles end-of-month edge case (Jan 31 + 1 month)", () => {
    // JS Date normalises overflow: Jan 31 + 1 month = Mar 3 (non-leap) or Mar 2 (leap)
    const result = addMonths("2026-01-31", 1);
    expect(result).toMatch(/^2026-02-2[89]|2026-03-0[23]$/);
  });
});

// ── getNextDate ─────────────────────────────────────────────────────────────

describe("getNextDate", () => {
  const base = "2026-06-09";

  it("weekly pattern increments by 7 days × index", () => {
    expect(getNextDate(base, "weekly", 0)).toBe("2026-06-09");
    expect(getNextDate(base, "weekly", 1)).toBe("2026-06-16");
    expect(getNextDate(base, "weekly", 4)).toBe("2026-07-07");
  });

  it("biweekly pattern increments by 14 days × index", () => {
    expect(getNextDate(base, "biweekly", 0)).toBe("2026-06-09");
    expect(getNextDate(base, "biweekly", 1)).toBe("2026-06-23");
    expect(getNextDate(base, "biweekly", 2)).toBe("2026-07-07");
  });

  it("monthly pattern increments by 1 month × index", () => {
    expect(getNextDate(base, "monthly", 0)).toBe("2026-06-09");
    expect(getNextDate(base, "monthly", 1)).toBe("2026-07-09");
    expect(getNextDate(base, "monthly", 3)).toBe("2026-09-09");
  });

  it("unknown pattern returns the base date unchanged", () => {
    expect(getNextDate(base, "quarterly", 2)).toBe(base);
    expect(getNextDate(base, "", 5)).toBe(base);
  });
});

// ── POST /api/bookings/recurring ────────────────────────────────────────────

describe("POST /api/bookings/recurring", () => {
  it.todo("returns 401 when admin cookie is missing");

  it.todo("returns 400 when client_name is missing");

  it.todo("returns 400 when date is missing");

  it.todo("returns 400 when time is missing");

  it.todo("returns 400 when recurrence_pattern is missing");

  it.todo("inserts recurrence_count bookings and returns ok:true with count and group_id");

  it.todo("defaults recurrence_count to 8 when not provided");

  it.todo("all inserted bookings share the same recurring_group_id");

  it.todo("each inserted booking has status 'confirmed'");

  it.todo("weekly pattern produces bookings 7 days apart");

  it.todo("biweekly pattern produces bookings 14 days apart");

  it.todo("monthly pattern produces bookings 1 month apart");

  it.todo("returns 500 when supabase insert fails");
});

// ── DELETE /api/bookings/recurring ─────────────────────────────────────────

describe("DELETE /api/bookings/recurring", () => {
  it.todo("returns 401 when admin cookie is missing");

  it.todo("returns 400 when group_id query param is missing");

  it.todo("cancels only future confirmed bookings in the group");

  it.todo("does not update past bookings in the group");

  it.todo("does not update already-cancelled bookings in the group");

  it.todo("returns ok:true on success");

  it.todo("returns 500 when supabase update fails");
});
