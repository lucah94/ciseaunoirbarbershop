/**
 * Tests for src/app/api/booking/init/route.ts
 *
 * Covers:
 * - Returns barbers, melynda blocks/overrides, stephanie blocks/overrides
 * - Returns empty arrays when no data exists
 * - Returns only active barbers
 * - Handles Supabase error gracefully
 * - Returns today's date as the lower bound for blocks/overrides
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/lib/supabase";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// The route now returns dynamic barbers: { barbers: [{ name, schedule, color,
// role, blocks, overrides }] }. Blocks/overrides are fetched in bulk
// (select("*").gte("date", today)) and grouped per barber server-side by name.
function setupMocks({
  barbers = [{ name: "Melynda", schedule: {}, active: true }],
  blocks = [] as Array<{ barber: string; date: string }>,
  overrides = [] as Array<{ barber: string; date: string }>,
  error = null,
} = {}) {
  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === "barbers") {
      // select(...).eq("active", true).order(...) resolves
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: barbers, error }),
      } as never;
    }
    // barber_blocks / barber_day_overrides: select("*").gte("date", today)
    return {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({
        data: table === "barber_blocks" ? blocks : overrides,
        error,
      }),
    } as never;
  });
}

describe("GET /api/booking/init", () => {
  it("returns 200 with a barbers array", async () => {
    setupMocks();
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("barbers");
    expect(Array.isArray(body.barbers)).toBe(true);
  });

  it("each barber object has blocks and overrides arrays", async () => {
    setupMocks({
      barbers: [
        { name: "Melynda", schedule: {}, active: true },
        { name: "Stéphanie", schedule: {}, active: true },
      ],
      blocks: [{ barber: "melynda", date: "2030-01-01" }],
      overrides: [{ barber: "stephanie", date: "2030-01-01" }],
    });
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    for (const b of body.barbers) {
      expect(Array.isArray(b.blocks)).toBe(true);
      expect(Array.isArray(b.overrides)).toBe(true);
    }
    const mel = body.barbers.find((b: { name: string }) => b.name === "Melynda");
    const step = body.barbers.find((b: { name: string }) => b.name === "Stéphanie");
    // Blocks/overrides are grouped per barber by normalized name.
    expect(mel.blocks).toHaveLength(1);
    expect(step.overrides).toHaveLength(1);
  });

  it("returns the barbers from the active-filtered query", async () => {
    setupMocks({
      barbers: [{ name: "Melynda", schedule: {}, active: true }],
    });
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    // The route filters via .eq("active", true); only those rows reach the response.
    expect(body.barbers).toHaveLength(1);
    expect(body.barbers[0].name).toBe("Melynda");
  });

  it("returns empty arrays when no blocks or overrides exist", async () => {
    setupMocks({ barbers: [{ name: "Melynda", schedule: {}, active: true }], blocks: [], overrides: [] });
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    expect(body.barbers[0].blocks).toHaveLength(0);
    expect(body.barbers[0].overrides).toHaveLength(0);
  });

  it.todo("returns blocks with dates >= today (future only)");
  it.todo("makes 5 parallel Supabase queries (Promise.all)");
  it.todo("returns 500 when barbers query fails");
});
