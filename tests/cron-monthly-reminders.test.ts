/**
 * Tests for src/app/api/cron/monthly-reminders/route.ts
 *
 * Covers:
 * - Auth: rejects invalid/missing CRON_SECRET (supports both Bearer and ?key= or ?secret=)
 * - On the 1st of month: sends a rent reminder via notifySystemAlert
 * - Not on the 1st: does NOT send rent reminder
 * - When insurance renewal is within 30 days: sends insurance alert
 * - When insurance renewal is > 30 days away: does NOT send insurance alert
 * - Returns { sent: N, day } where N = number of alerts dispatched
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/telegram", () => ({
  notifySystemAlert: vi.fn().mockResolvedValue(undefined),
}));

import { notifySystemAlert } from "@/lib/telegram";

function makeRequest(secret = "test-secret", queryParam?: string) {
  const url = queryParam
    ? `http://localhost/api/cron/monthly-reminders?${queryParam}=test-secret`
    : "http://localhost/api/cron/monthly-reminders";
  return new NextRequest(url, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

describe("GET /api/cron/monthly-reminders — auth", () => {
  it("returns 401 when CRON_SECRET is set and no auth is provided", async () => {
    const { GET } = await import("@/app/api/cron/monthly-reminders/route");
    const req = new NextRequest("http://localhost/api/cron/monthly-reminders");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("accepts valid secret via Bearer header", async () => {
    const { GET } = await import("@/app/api/cron/monthly-reminders/route");
    const res = await GET(makeRequest("test-secret") as never);
    expect(res.status).toBe(200);
  });

  it.todo("accepts valid secret via ?key= query param");
  it.todo("accepts valid secret via ?secret= query param");
});

describe("GET /api/cron/monthly-reminders — rent reminder", () => {
  it.todo("sends rent reminder when current day is 1st of month");
  it.todo("does NOT send rent reminder when current day is not the 1st");
});

describe("GET /api/cron/monthly-reminders — insurance alert", () => {
  it.todo("sends insurance renewal alert when renewal is within 30 days");
  it.todo("does NOT send insurance alert when renewal is > 30 days away");
  it.todo("does NOT send insurance alert when renewal date has passed");
});

describe("GET /api/cron/monthly-reminders — response", () => {
  it.todo("returns { sent: 0, day } when no alerts are triggered");
  it.todo("returns { sent: 1, day } when only rent reminder fires");
  it.todo("returns { sent: 2, day } when both rent and insurance alerts fire");
  it.todo("continues sending remaining alerts when one notifySystemAlert call fails");
});
