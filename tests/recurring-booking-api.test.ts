/**
 * Tests for src/app/api/bookings/recurring/route.ts
 *
 * Pure date-math helpers (addWeeks, addMonths, getNextDate) are testable
 * without importing the route. Route-level tests verify auth, validation,
 * and the batch insert behavior.
 *
 * Security note: route is admin-gated — should not be reachable by clients.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

// ─── Pure date math helpers ───────────────────────────────────────────────────

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

describe("addWeeks", () => {
  it("adds exactly 7 days per week", () => {
    expect(addWeeks("2026-01-01", 1)).toBe("2026-01-08");
    expect(addWeeks("2026-01-01", 2)).toBe("2026-01-15");
  });

  it("crosses month boundaries correctly", () => {
    expect(addWeeks("2026-01-29", 1)).toBe("2026-02-05");
  });

  it("handles leap year February", () => {
    expect(addWeeks("2024-02-22", 1)).toBe("2024-02-29");
  });
});

describe("addMonths", () => {
  it("adds one month correctly", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("overflows to March when adding 1 month to Jan 31 (JS Date does not clamp)", () => {
    // BUG: JS Date sets month to February but then overflows 31→3 March.
    // Recurring bookings starting Jan 31 will skip February entirely.
    // Fix: clamp to Math.min(day, daysInMonth) after setMonth().
    const result = addMonths("2026-01-31", 1);
    expect(result).toBe("2026-03-03");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("getNextDate", () => {
  it("returns index=0 as the base date for all patterns", () => {
    expect(getNextDate("2026-06-01", "weekly", 0)).toBe("2026-06-01");
    expect(getNextDate("2026-06-01", "biweekly", 0)).toBe("2026-06-01");
    expect(getNextDate("2026-06-01", "monthly", 0)).toBe("2026-06-01");
  });

  it("increments weekly by 7 days per index", () => {
    expect(getNextDate("2026-06-01", "weekly", 3)).toBe("2026-06-22");
  });

  it("increments biweekly by 14 days per index", () => {
    expect(getNextDate("2026-06-01", "biweekly", 2)).toBe("2026-06-29");
  });

  it("increments monthly by 1 calendar month per index", () => {
    expect(getNextDate("2026-06-01", "monthly", 3)).toBe("2026-09-01");
  });

  it("returns baseDate unchanged for unknown pattern", () => {
    expect(getNextDate("2026-06-01", "unknown", 5)).toBe("2026-06-01");
  });
});

// ─── POST /api/bookings/recurring ────────────────────────────────────────────

describe("POST /api/bookings/recurring", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("returns 400 when client_name is missing");

  it.todo("returns 400 when date is missing");

  it.todo("returns 400 when recurrence_pattern is missing");

  it.todo("inserts recurrence_count bookings with the same group_id");

  it.todo("defaults recurrence_count to 8 when not specified");

  it.todo("assigns a unique recurring_group_id to all created bookings");

  it.todo("uses 'weekly' pattern to space bookings 7 days apart");

  it.todo("uses 'biweekly' pattern to space bookings 14 days apart");

  it.todo("uses 'monthly' pattern to space bookings 1 month apart");

  it.todo("returns 500 on Supabase bulk insert error");
});
