/**
 * Tests for:
 *  - src/app/api/calendar/[barber]/route.ts           (barber agenda view)
 *  - src/app/api/calendar/[barber]/[token]/route.ts   (token-authenticated iCal)
 *  - src/app/api/calendar/booking/[id]/route.ts       (single booking card)
 *
 * calendar/[barber]/[token] leaks an auth token in the URL (logged in server
 * access logs). These tests document the current behavior and surface the risk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
  verifyToken: vi.fn().mockReturnValue(true),
}));

beforeEach(() => vi.resetAllMocks());

// ─── GET /api/calendar/[barber] ───────────────────────────────────────────────

describe("GET /api/calendar/[barber]", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("returns bookings for the specified barber in date range");

  it.todo("accepts 'start' and 'end' query params to filter date range");

  it.todo("returns empty array when barber has no bookings in range");

  it.todo("returns 500 on Supabase error");

  it.todo("normalizes barber name for case-insensitive matching");
});

// ─── GET /api/calendar/[barber]/[token] ───────────────────────────────────────

describe("GET /api/calendar/[barber]/[token]", () => {
  it.todo("returns 403 when token does not match the expected barber token");

  it.todo("returns bookings as iCal or JSON when token is valid");

  it.todo("token appears in URL and is logged in server access logs (document IDOR risk)");

  it.todo("returns 500 on Supabase error");
});

// ─── GET /api/calendar/booking/[id] ──────────────────────────────────────────

describe("GET /api/calendar/booking/[id]", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("returns booking details as JSON for a valid booking id");

  it.todo("returns 404 when booking id does not exist");

  it.todo("returns 500 on Supabase error");
});
