/**
 * Tests for src/app/api/cron/winback-sms/route.ts
 *
 * Covers: auth guard, dormant client identification (60-120 day window),
 * 30-per-run cap, dedup via sms_blacklist, sendSMS delegation,
 * Twilio config guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/cron/winback-sms/route";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";
import type { NextRequest } from "next/server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: { get: (h: string) => (h === "authorization" ? authHeader ?? null : null) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.TWILIO_ACCOUNT_SID = "ACTEST";
  process.env.TWILIO_PHONE_NUMBER = "+15140000000";
});

// ── Auth guard ───────────────────────────────────────────────────────────────

describe("GET /api/cron/winback-sms — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await GET(makeRequest("Bearer bad-secret"));
    expect(res.status).toBe(401);
  });
});

// ── Twilio config guard ──────────────────────────────────────────────────────

describe("GET /api/cron/winback-sms — Twilio guard", () => {
  it("returns ok:false with reason when TWILIO_ACCOUNT_SID is missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toContain("Twilio");
  });

  it("returns ok:false with reason when TWILIO_PHONE_NUMBER is missing", async () => {
    delete process.env.TWILIO_PHONE_NUMBER;
    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});

// ── Dormant client detection ─────────────────────────────────────────────────

describe("GET /api/cron/winback-sms — dormant detection", () => {
  function stubBookingsAndBlacklist(
    bookings: { client_phone: string; client_name: string; date: string }[],
    blacklist: { phone: string }[] = []
  ) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: bookings, error: null }),
        };
      }
      // sms_blacklist
      return {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: blacklist }),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
    });
  }

  it("sends SMS to dormant client (last visit 61-119 days ago)", async () => {
    const dormantDate = new Date();
    dormantDate.setDate(dormantDate.getDate() - 75);
    const dateStr = dormantDate.toISOString().split("T")[0];

    stubBookingsAndBlacklist([
      { client_phone: "4180000001", client_name: "Jean Tremblay", date: dateStr },
    ]);

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sent).toBe(1);
    expect(sendSMS).toHaveBeenCalledOnce();
  });

  it("skips client whose last visit was more recent than 60 days", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    const dateStr = recentDate.toISOString().split("T")[0];

    stubBookingsAndBlacklist([
      { client_phone: "4180000002", client_name: "Marie Dubois", date: dateStr },
    ]);

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("skips client whose last visit was more than 120 days ago (too stale)", async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 130);
    const dateStr = staleDate.toISOString().split("T")[0];

    stubBookingsAndBlacklist([
      { client_phone: "4180000003", client_name: "Luc Roy", date: dateStr },
    ]);

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("skips client who already received a winback SMS in the last 30 days", async () => {
    const dormantDate = new Date();
    dormantDate.setDate(dormantDate.getDate() - 75);
    const dateStr = dormantDate.toISOString().split("T")[0];

    stubBookingsAndBlacklist(
      [{ client_phone: "4180000004", client_name: "Pierre Gagnon", date: dateStr }],
      [{ phone: "4180000004" }] // already in dedup set
    );

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.skipped).toBe(1);
  });

  it("caps batch at 30 clients per run", async () => {
    const dormantDate = new Date();
    dormantDate.setDate(dormantDate.getDate() - 75);
    const dateStr = dormantDate.toISOString().split("T")[0];

    const manyClients = Array.from({ length: 50 }, (_, i) => ({
      client_phone: `418000${String(i).padStart(4, "0")}`,
      client_name: `Client ${i}`,
      date: dateStr,
    }));

    stubBookingsAndBlacklist(manyClients);

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.sent).toBeLessThanOrEqual(30);
  });

  it("uses latest visit date when client has multiple bookings", async () => {
    const old = new Date();
    old.setDate(old.getDate() - 90);

    const recent = new Date();
    recent.setDate(recent.getDate() - 30);

    stubBookingsAndBlacklist([
      { client_phone: "4180000005", client_name: "Test User", date: old.toISOString().split("T")[0] },
      { client_phone: "4180000005", client_name: "Test User", date: recent.toISOString().split("T")[0] },
    ]);

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    // Most recent visit = 30 days ago → not dormant
    expect(json.sent).toBe(0);
  });
});

// ── Supabase error ────────────────────────────────────────────────────────────

describe("GET /api/cron/winback-sms — DB error", () => {
  it("returns 500 when bookings query fails", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: "DB down" } }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(500);
  });
});
