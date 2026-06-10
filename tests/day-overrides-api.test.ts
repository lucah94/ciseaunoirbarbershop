/**
 * Tests for src/app/api/admin/day-overrides/route.ts
 *
 * Covers: GET (admin OR barber auth), POST (admin-only, upsert),
 * DELETE (admin-only), Supabase error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

import { GET, POST, DELETE } from "@/app/api/admin/day-overrides/route";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function makeRequest(opts: {
  adminAuth?: string;
  barberAuth?: string;
  body?: unknown;
  params?: Record<string, string>;
} = {}): NextRequest {
  const cookies = new Map<string, { value: string }>();
  if (opts.adminAuth) cookies.set("admin_auth", { value: opts.adminAuth });
  if (opts.barberAuth) cookies.set("barber_auth", { value: opts.barberAuth });

  return {
    cookies: { get: (n: string) => cookies.get(n) },
    nextUrl: {
      searchParams: new URLSearchParams(opts.params ?? {}),
    },
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: () => null },
  } as unknown as NextRequest;
}

function makeChain(resolveWith: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveWith),
    mockResolvedValue: undefined,
    then: undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/admin/day-overrides", () => {
  it("returns 401 when neither admin nor barber cookie is present", async () => {
    mockRequireAdmin.mockReturnValue(NextResponse.json({ error: "Non autorisé" }, { status: 401 }));
    const req = makeRequest({});
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("allows request when barber_auth cookie is present (even without admin)", async () => {
    mockRequireAdmin.mockReturnValue(NextResponse.json({ error: "Non autorisé" }, { status: 401 }));
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ barberAuth: "some-token" });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("allows request when admin is authorized", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: "1", barber: "Melynda", date: "2026-06-10", open: "10:00", close: "16:00" }], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ adminAuth: "token" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it("filters by barber query param when provided", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ adminAuth: "token", params: { barber: "Melynda" } });
    await GET(req);
    expect(chain.eq).toHaveBeenCalledWith("barber", "Melynda");
  });

  it("returns 500 when Supabase query fails", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ adminAuth: "token" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/day-overrides", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockReturnValue(NextResponse.json({ error: "Non autorisé" }, { status: 401 }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("upserts the day override and returns the created record", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const record = { id: "uuid-1", barber: "Melynda", date: "2026-07-04", open: "09:00", close: "17:00" };
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: record, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ adminAuth: "token", body: record });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.barber).toBe("Melynda");
  });

  it("uses barber+date as the upsert conflict key", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ body: { barber: "Stéphanie", date: "2026-07-05", open: "09:00", close: "17:00" } });
    await POST(req);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ barber: "Stéphanie", date: "2026-07-05" }),
      expect.objectContaining({ onConflict: "barber,date" })
    );
  });

  it("returns 500 when upsert fails", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "Conflict" } }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/admin/day-overrides", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockReturnValue(NextResponse.json({ error: "Non autorisé" }, { status: 401 }));
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(401);
  });

  it("deletes the override by id and returns ok:true", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const req = makeRequest({ body: { id: "uuid-1" } });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(chain.eq).toHaveBeenCalledWith("id", "uuid-1");
  });

  it("returns 500 when delete fails", async () => {
    mockRequireAdmin.mockReturnValue(null);
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: "FK violation" } }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(makeRequest({ body: { id: "uuid-1" } }));
    expect(res.status).toBe(500);
  });
});
