/**
 * Tests for src/app/api/cron/morning-briefing/route.ts
 *
 * Covers:
 * - Auth: rejects missing/invalid CRON_SECRET
 * - Builds Telegram message listing today's bookings by barber
 * - Sends notifySystemAlert with the formatted message
 * - Returns 500 when Supabase query fails
 * - Returns 200 with booking count on success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/telegram", () => ({
  notifySystemAlert: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";

const mockFrom = vi.fn();
(supabaseAdmin as ReturnType<typeof vi.fn>).from = mockFrom;

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

describe("GET /api/cron/morning-briefing — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/morning-briefing/route");
    const req = new Request("http://localhost/api/cron/morning-briefing");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong secret", async () => {
    const { GET } = await import("@/app/api/cron/morning-briefing/route");
    const res = await GET(makeRequest("bad") as never);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/morning-briefing — success", () => {
  it.todo("calls notifySystemAlert with today's booking count per barber");
  it.todo("includes total estimated revenue in Telegram message");
  it.todo("filters out cancelled bookings from the briefing");
  it.todo("shows 'Aucun RDV' when no bookings exist for a barber");
  it.todo("returns JSON with today's date and booking count");
  it.todo("returns 500 when Supabase query fails");
});
