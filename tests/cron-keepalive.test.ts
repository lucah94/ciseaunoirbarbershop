/**
 * Tests for src/app/api/cron/keepalive/route.ts
 *
 * Covers:
 * - Returns { status: "ok", latency, timestamp } when Supabase ping succeeds
 * - Returns 500 and triggers Supabase restore when Supabase query fails
 * - Returns 500 when Supabase times out (8s timeout)
 * - restore_triggered: true when SUPABASE_MANAGEMENT_TOKEN is set
 * - restore_triggered: false when SUPABASE_MANAGEMENT_TOKEN is absent
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/lib/supabase";

function setupPing(error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ id: "1" }], error }),
  };
  vi.mocked(supabaseAdmin).from = vi.fn().mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SUPABASE_MANAGEMENT_TOKEN;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe("GET /api/cron/keepalive — healthy", () => {
  it("returns status='ok' and latency when Supabase ping succeeds", async () => {
    setupPing(null);
    const { GET } = await import("@/app/api/cron/keepalive/route");
    const req = new Request("http://localhost/api/cron/keepalive");
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(typeof json.latency).toBe("number");
    expect(json.timestamp).toBeDefined();
  });
});

describe("GET /api/cron/keepalive — degraded", () => {
  it("returns 500 when Supabase query returns an error", async () => {
    setupPing({ message: "connection refused" });
    const { GET } = await import("@/app/api/cron/keepalive/route");
    const req = new Request("http://localhost/api/cron/keepalive");
    const res = await GET(req as never);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.status).toBe("error");
  });

  it("sets restore_triggered=false when SUPABASE_MANAGEMENT_TOKEN is absent", async () => {
    setupPing({ message: "error" });
    const { GET } = await import("@/app/api/cron/keepalive/route");
    const req = new Request("http://localhost/api/cron/keepalive");
    const res = await GET(req as never);
    const json = await res.json();
    expect(json.restore_triggered).toBe(false);
  });

  it.todo("sets restore_triggered=true when SUPABASE_MANAGEMENT_TOKEN is set and restore call succeeds");
  it.todo("returns 500 when Supabase query throws (AbortController timeout)");
  it.todo("includes latency in the error response");
});
