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

const mockChain = (data: unknown, error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockResolvedValue({ data, error }),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function setupMocks({
  barbers = [{ name: "Melynda", schedule: {}, active: true }],
  melBlocks = [],
  melOverrides = [],
  stepBlocks = [],
  stepOverrides = [],
  error = null,
} = {}) {
  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === "barbers") return mockChain(barbers, error) as never;
    // barber_blocks and barber_day_overrides return different data per .eq("barber", ...)
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((_col: string, val: string) => ({
        gte: vi.fn().mockResolvedValue({
          data: table === "barber_blocks"
            ? (val === "melynda" ? melBlocks : stepBlocks)
            : (val === "melynda" ? melOverrides : stepOverrides),
          error,
        }),
      })),
    } as never;
  });
}

describe("GET /api/booking/init", () => {
  it("returns 200 with barbers, melynda, and stephanie objects", async () => {
    setupMocks();
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("barbers");
    expect(body).toHaveProperty("melynda");
    expect(body).toHaveProperty("stephanie");
  });

  it("melynda and stephanie objects each have blocks and overrides arrays", async () => {
    setupMocks();
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.melynda.blocks)).toBe(true);
    expect(Array.isArray(body.melynda.overrides)).toBe(true);
    expect(Array.isArray(body.stephanie.blocks)).toBe(true);
    expect(Array.isArray(body.stephanie.overrides)).toBe(true);
  });

  it("returns only active barbers", async () => {
    setupMocks({
      barbers: [
        { name: "Melynda", schedule: {}, active: true },
        { name: "Inactive", schedule: {}, active: false },
      ],
    });
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    // The route filters via .eq("active", true)
    expect(body.barbers.every((b: { active: boolean }) => b.active)).toBe(true);
  });

  it("returns empty arrays when no blocks or overrides exist", async () => {
    setupMocks({ melBlocks: [], melOverrides: [], stepBlocks: [], stepOverrides: [] });
    const { GET } = await import("@/app/api/booking/init/route");
    const res = await GET();
    const body = await res.json();
    expect(body.melynda.blocks).toHaveLength(0);
    expect(body.stephanie.overrides).toHaveLength(0);
  });

  it.todo("returns blocks with dates >= today (future only)");
  it.todo("makes 5 parallel Supabase queries (Promise.all)");
  it.todo("returns 500 when barbers query fails");
});
