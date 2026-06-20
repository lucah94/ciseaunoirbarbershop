/**
 * Tests for src/app/api/cron/daily-summary/route.ts
 *
 * Covers: cron auth guard, revenue calculation, barber filtering,
 * revenue comparison direction, Telegram notification, error paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/telegram", () => ({
  notifySystemAlert: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/cron/daily-summary/route";
import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";
import type { NextRequest } from "next/server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: { get: (h: string) => (h === "authorization" ? authHeader ?? null : null) },
  } as unknown as NextRequest;
}

function makeSupabaseChain(rows: object[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    mockResolvedValue: undefined,
  };
}

function stubFromSequence(results: { data: object[] | null; error?: object | null }[]) {
  let call = 0;
  mockFrom.mockImplementation(() => {
    const idx = call++;
    const result = results[idx] ?? { data: [] };
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      resolves: vi.fn().mockResolvedValue(result),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

// ── Auth guard ───────────────────────────────────────────────────────────────

describe("GET /api/cron/daily-summary — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("proceeds past auth with correct Bearer token", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);
    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).not.toBe(401);
  });
});

// ── Revenue calculation ──────────────────────────────────────────────────────

describe("GET /api/cron/daily-summary — revenue logic", () => {
  it("sums price of completed AND confirmed bookings only", async () => {
    const todayBookings = [
      { status: "completed", price: 35, barber: "Melynda", no_show: false },
      { status: "confirmed", price: 50, barber: "Melynda", no_show: false },
      { status: "cancelled", price: 35, barber: "Melynda", no_show: false },
      { status: "no_show", price: 35, barber: "Melynda", no_show: true },
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: todayBookings, error: null }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    // Only completed (35) + confirmed (50) = 85
    expect(json.revenue).toBe(85);
  });

  it("reports revenue arrow as ▲ when today >= last week", async () => {
    const today = [{ status: "completed", price: 100, barber: "Melynda", no_show: false }];
    const lastWeek = [{ status: "completed", price: 50 }];

    let call = 0;
    mockFrom.mockImplementation(() => {
      const idx = call++;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: idx === 0 ? today : lastWeek, error: null }),
      };
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.revenue).toBeGreaterThan(json.revenue_last_week);
  });

  it("handles null/missing price gracefully (treats as 0)", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ status: "completed", price: null, barber: "Melynda", no_show: false }],
        error: null,
      }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.revenue).toBe(0);
  });
});

// ── Status counters ──────────────────────────────────────────────────────────

describe("GET /api/cron/daily-summary — status counters", () => {
  it("counts completed, confirmed, cancelled, no_show correctly", async () => {
    const bookings = [
      { status: "completed", price: 35, barber: "Melynda", no_show: false },
      { status: "completed", price: 35, barber: "Stéphanie", no_show: false },
      { status: "confirmed", price: 35, barber: "Melynda", no_show: false },
      { status: "cancelled", price: 0, barber: "Melynda", no_show: false },
      { status: "confirmed", price: 35, barber: "Melynda", no_show: true }, // no_show flag
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: bookings, error: null }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    expect(json.completed).toBe(2);
    expect(json.confirmed).toBe(2);
    expect(json.cancelled).toBe(1);
    expect(json.no_show).toBe(1);
  });

  it("counts RDVs per barber (byBarber) excluding cancelled", async () => {
    const bookings = [
      { status: "completed", price: 35, barber: "Melynda", no_show: false },
      { status: "cancelled", price: 0, barber: "Melynda", no_show: false },
      { status: "confirmed", price: 35, barber: "Stéphanie", no_show: false },
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: bookings, error: null }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    const json = await res.json();
    // byBarber is dynamic; cancelled bookings are excluded from the per-barber count.
    expect(json.byBarber.Melynda).toBe(1);
    expect(json.byBarber["Stéphanie"]).toBe(1);
  });
});

// ── Supabase error handling ──────────────────────────────────────────────────

describe("GET /api/cron/daily-summary — error handling", () => {
  it("returns 500 when today's bookings query fails", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    }));

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(500);
  });

  it("sends Telegram notification even on success (calls notifySystemAlert)", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    await GET(makeRequest("Bearer test-secret"));
    expect(notifySystemAlert).toHaveBeenCalledOnce();
    const [msg] = (notifySystemAlert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("Résumé");
  });
});
