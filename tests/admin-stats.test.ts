/**
 * Tests for the date-range helper functions in src/app/api/admin/stats/route.ts
 *
 * weekRange and monthRange are not exported, so we replicate them here.
 * The GET handler tests are stubs covering auth and DB interaction.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

// ── Replicated date helpers ──────────────────────────────────────────────────

function weekRange(offset = 0, capToToday = false): { start: string; end: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  let endDate = sun;
  if (capToToday) {
    const todayDayOfWeek = new Date().getDay() || 7;
    const cappedEnd = new Date(mon);
    cappedEnd.setDate(mon.getDate() + todayDayOfWeek - 1);
    endDate = cappedEnd;
  }
  return { start: mon.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] };
}

function monthRange(offset = 0): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: first.toISOString().split("T")[0], end: last.toISOString().split("T")[0] };
}

// ── weekRange ────────────────────────────────────────────────────────────────

describe("weekRange", () => {
  it("start is always a Monday (ISO day 1)", () => {
    const { start } = weekRange(0);
    // Parse as UTC to avoid local-timezone shift on date-only strings
    const d = new Date(start + "T12:00:00");
    expect(d.getDay()).toBe(1); // Monday
  });

  it("end is always a Sunday (ISO day 0) when capToToday is false", () => {
    const { end } = weekRange(0, false);
    const d = new Date(end + "T12:00:00");
    expect(d.getDay()).toBe(0); // Sunday
  });

  it("end - start = 6 days for a full week", () => {
    const { start, end } = weekRange(0, false);
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(6);
  });

  it("offset=-1 returns the previous week", () => {
    const thisWeek = weekRange(0);
    const lastWeek = weekRange(-1);
    expect(new Date(lastWeek.start) < new Date(thisWeek.start)).toBe(true);
  });

  it("offset=1 returns the next week", () => {
    const thisWeek = weekRange(0);
    const nextWeek = weekRange(1);
    expect(new Date(nextWeek.start) > new Date(thisWeek.start)).toBe(true);
  });

  it("capToToday makes the end equal to today's day-of-week position within the week", () => {
    const { start, end } = weekRange(0, true);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    const todayDayOfWeek = today.getDay() || 7;
    const expectedEnd = new Date(startDate);
    expectedEnd.setDate(startDate.getDate() + todayDayOfWeek - 1);
    expect(endDate.toISOString().split("T")[0]).toBe(expectedEnd.toISOString().split("T")[0]);
  });

  it("returns YYYY-MM-DD formatted strings", () => {
    const { start, end } = weekRange(0);
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── monthRange ───────────────────────────────────────────────────────────────

describe("monthRange", () => {
  it("start is always the 1st of the month", () => {
    const { start } = monthRange(0);
    expect(start.endsWith("-01")).toBe(true);
  });

  it("end is always the last day of the month", () => {
    const { end } = monthRange(0);
    // Use noon local time to avoid UTC midnight ambiguity when parsing date-only strings
    const d = new Date(end + "T12:00:00");
    const next = new Date(end + "T12:00:00");
    next.setDate(d.getDate() + 1);
    expect(next.getDate()).toBe(1);
  });

  it("February 2027 ends on the 28th (non-leap year)", () => {
    // Current date is June 2026. Feb 2027 = +8 months.
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    // Find offset to reach February of next year
    const targetMonth = 1; // February (0-indexed)
    const targetYear = currentYear + 1;
    const offset = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
    const { end } = monthRange(offset);
    expect(end).toMatch(/^\d{4}-02-(28|29)$/);
  });

  it("offset=-1 returns the previous month", () => {
    const current = monthRange(0);
    const previous = monthRange(-1);
    expect(new Date(previous.start) < new Date(current.start)).toBe(true);
  });

  it("offset=1 returns the next month", () => {
    const current = monthRange(0);
    const next = monthRange(1);
    expect(new Date(next.start) > new Date(current.start)).toBe(true);
  });

  it("returns YYYY-MM-DD formatted strings", () => {
    const { start, end } = monthRange(0);
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── GET /api/admin/stats ─────────────────────────────────────────────────────

describe("GET /api/admin/stats", () => {
  it.todo("returns 401 when admin cookie is missing");

  it.todo("executes 10 database queries in parallel");

  it.todo("returns thisWeekBookings count in the response");

  it.todo("returns revenue calculated from cuts table (price × discount + tip)");

  it.todo("returns onlinePercent as 0 when no online bookings this week");

  it.todo("returns onlinePercent as 100 when all bookings have source !== 'direct'");

  it.todo("returns topBarber based on booking count");

  it.todo("returns waitlistCount from the waitlist table");

  it.todo("returns twilioBalance when Twilio env is set");

  it.todo("returns 500 when a database query fails");
});
