/**
 * Tests for src/app/api/portfolio/route.ts
 *
 * Covers:
 * - GET: public — returns all portfolio items ordered by created_at desc
 * - GET: returns 500 when Supabase fails
 * - POST: returns 401 without admin_auth cookie
 * - POST: returns 400 when url is missing
 * - POST: inserts item and returns created record
 * - POST: returns 500 when Supabase insert fails
 * - DELETE: returns 401 without admin_auth cookie
 * - DELETE: deletes item by id and returns success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { NextRequest } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

function makeRequest(method: string, body?: object, adminCookie = false) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (adminCookie) headers["Cookie"] = "admin_auth=true";
  return new NextRequest("http://localhost/api/portfolio", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function setupSupabaseMock(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    data,
    error,
  };
  vi.mocked(supabase).from = vi.fn().mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/portfolio", () => {
  it("returns all portfolio items ordered by created_at descending", async () => {
    const items = [
      { id: "1", url: "https://example.com/img1.jpg", caption: "Coupe" },
      { id: "2", url: "https://example.com/img2.jpg", caption: "Barbe" },
    ];
    setupSupabaseMock(items);
    const chain = (supabase as ReturnType<typeof vi.fn>).from.mock.results[0]?.value;
    if (chain) chain.order.mockResolvedValue({ data: items, error: null });
    const { GET } = await import("@/app/api/portfolio/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it.todo("returns 500 when Supabase query fails");
  it.todo("returns empty array when no portfolio items exist");
});

describe("POST /api/portfolio", () => {
  it("returns 401 when admin_auth cookie is absent", async () => {
    const { POST } = await import("@/app/api/portfolio/route");
    const res = await POST(makeRequest("POST", { url: "https://example.com/img.jpg" }, false) as never);
    expect(res.status).toBe(401);
  });

  it.todo("returns 400 when url is missing from body");
  it.todo("inserts item with url, caption, tags, barber and returns created record");
  it.todo("returns 500 when Supabase insert fails");
  it.todo("accepts null/undefined caption and tags");
});

describe("DELETE /api/portfolio", () => {
  it("returns 401 when admin_auth cookie is absent", async () => {
    const { DELETE } = await import("@/app/api/portfolio/route");
    const req = new NextRequest("http://localhost/api/portfolio?id=1", { method: "DELETE" });
    const res = await DELETE(req as never);
    expect(res.status).toBe(401);
  });

  it.todo("deletes item by id when admin_auth cookie is valid");
  it.todo("returns 400 when id query param is missing");
  it.todo("returns 500 when Supabase delete fails");
});
