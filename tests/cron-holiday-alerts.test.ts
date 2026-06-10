/**
 * Tests for src/app/api/cron/holiday-alerts/route.ts
 *
 * Covers: auth, threshold alerting (14/7/3/1 days), no-upcoming-holiday
 * handling, Supabase booking lookup, Telegram message format, edge cases.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/holidays-qc", () => ({
  getUpcomingHolidays: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

const makeRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost/api/cron/holiday-alerts", {
    headers: { authorization: "Bearer test-secret", ...headers },
  });

describe("GET /api/cron/holiday-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_GROUP_CHAT_ID = "-123";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { alerted: 0 } when no upcoming holidays within any threshold");

  it.todo("sends Telegram alert when a holiday is exactly 14 days away");

  it.todo("sends Telegram alert when a holiday is exactly 7 days away");

  it.todo("sends Telegram alert when a holiday is exactly 3 days away");

  it.todo("sends Telegram alert when a holiday is exactly 1 day away");

  it.todo("does NOT alert for a holiday 15 days away");

  it.todo("does NOT alert for a holiday 2 days away (not in thresholds)");

  it.todo("includes holiday name in Telegram message");

  it.todo("includes number of bookings affected in alert when bookings exist");

  it.todo("does not send Telegram message when TELEGRAM_BOT_TOKEN is missing");

  it.todo("returns 500 when getUpcomingHolidays throws");
});
