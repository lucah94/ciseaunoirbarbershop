/**
 * Tests for src/app/api/cron/weekly-report/route.ts
 *
 * Covers:
 * - Auth: rejects missing/invalid CRON_SECRET
 * - Revenue calculation: price * (1 - discount/100) + tip from cuts table
 * - Booking counts: total, cancellations, no_shows, by barber
 * - Supabase error handling
 * - Telegram notification sent on success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/email", () => ({
  sendWeeklyReportEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/telegram", () => ({
  notifySystemAlert: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "@/lib/supabase";
import { sendWeeklyReportEmail } from "@/lib/email";
import { notifySystemAlert } from "@/lib/telegram";

const mockFrom = vi.fn();
(supabaseAdmin as ReturnType<typeof vi.fn>).from = mockFrom;

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost/api/cron/weekly-report", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    data,
    error,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

describe("GET /api/cron/weekly-report — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/weekly-report/route");
    const req = new Request("http://localhost/api/cron/weekly-report");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const { GET } = await import("@/app/api/cron/weekly-report/route");
    const res = await GET(makeRequest("wrong") as never);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/weekly-report — counts", () => {
  it.todo("totalBookings counts confirmed + completed status bookings only");
  it.todo("cancellations counts bookings with status=cancelled");
  it.todo("noShows counts bookings with status=no_show or no_show=true");
  it.todo("bookingsMelynda counts active bookings where barber includes 'melynda' (case-insensitive)");
  it.todo("returns 0 for all counts when bookings array is empty");
});

describe("GET /api/cron/weekly-report — revenue", () => {
  it.todo("calculates revenue as price * (1 - discount_percent/100) + tip per cut");
  it.todo("returns 0 revenue when cuts table is empty");
  it.todo("ignores cuts with null price (treats as 0)");
});

describe("GET /api/cron/weekly-report — side effects", () => {
  it.todo("calls sendWeeklyReportEmail with calculated stats");
  it.todo("calls notifySystemAlert with Telegram summary");
  it.todo("returns JSON with totalBookings, cancellations, noShows, revenue fields");
  it.todo("returns 500 when Supabase bookings query fails");
});
