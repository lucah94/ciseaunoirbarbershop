/**
 * Tests for /api/cron/keepalive
 *
 * SECURITY NOTE (from audit 2026-06-10): This endpoint has NO authentication.
 * Any caller can trigger Supabase restore. Tests document current behavior.
 * Fix: add CRON_SECRET header check before processing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

function makeBookingsChain(result: { data: null | unknown; error: null | { message: string } }) {
  return {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function makeReq() {
  return new Request("https://ciseaunoirbarbershop.com/api/cron/keepalive", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "test-secret";
  delete process.env.SUPABASE_MANAGEMENT_TOKEN;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue({ status: "ok" }),
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/cron/keepalive", () => {
  it("returns 200 with status:ok when Supabase is reachable", async () => {
    const chain = makeBookingsChain({ data: [{ id: "1" }], error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const res = await GET(makeReq() as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.latency).toBe("number");
    expect(body.timestamp).toBeTruthy();
  });

  it("returns 500 when Supabase returns an error", async () => {
    const chain = makeBookingsChain({ data: null, error: { message: "DB unavailable" } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const res = await GET(makeReq() as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe("error");
    expect(body.error).toContain("DB unavailable");
  });

  it("triggers restore when Supabase errors and SUPABASE_MANAGEMENT_TOKEN is set", async () => {
    // The token is read at module-level, so we must reset modules and set env before re-importing
    process.env.SUPABASE_MANAGEMENT_TOKEN = "test-token";
    vi.resetModules();
    vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

    const { supabaseAdmin: supabase2 } = await import("@/lib/supabase");
    const chain = makeBookingsChain({ data: null, error: { message: "paused" } });
    vi.mocked(supabase2.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase2.from>);

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const res = await GET(makeReq() as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(body.restore_triggered).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/restore"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not trigger restore when SUPABASE_MANAGEMENT_TOKEN is absent", async () => {
    // Reset modules so the module-level constant re-reads the (absent) env var
    delete process.env.SUPABASE_MANAGEMENT_TOKEN;
    vi.resetModules();
    vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

    const { supabaseAdmin: supabase2 } = await import("@/lib/supabase");
    const chain = makeBookingsChain({ data: null, error: { message: "paused" } });
    vi.mocked(supabase2.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase2.from>);

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const res = await GET(makeReq() as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(body.restore_triggered).toBe(false);
  });

  it("returns 500 on unexpected exception", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      throw new Error("unexpected");
    });

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const res = await GET(makeReq() as Parameters<typeof GET>[0]);

    expect(res.status).toBe(500);
  });

  // Security gap documented by audit 2026-06-10
  it("SECURITY: responds to unauthenticated requests (no auth check — CRITICAL gap)", async () => {
    const chain = makeBookingsChain({ data: [{}], error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/cron/keepalive/route");
    const req = makeReq(); // no Authorization header, no CRON_SECRET
    const res = await GET(req as Parameters<typeof GET>[0]);

    // Documents current (insecure) behavior — should be 401 after fix
    expect(res.status).toBe(200);
  });
});
