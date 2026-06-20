/**
 * Tests for src/app/api/clients/route.ts
 *
 * Covers: empty query, too-short query, valid search, DB error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(() => null),
  requireBarber: vi.fn(() => null),
}));

import { supabaseAdmin as supabase } from "@/lib/supabase";
import { GET } from "@/app/api/clients/route";
import { NextRequest } from "next/server";

function makeRequest(q?: string): NextRequest {
  const url = q !== undefined
    ? `http://localhost/api/clients?q=${encodeURIComponent(q)}`
    : "http://localhost/api/clients";
  return new NextRequest(url);
}

function mockChain(returnValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue(returnValue);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/clients", () => {
  it("returns empty array when q param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("returns empty array when q is an empty string", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("returns empty array when q is only 1 character (below minimum)", async () => {
    const res = await GET(makeRequest("J"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("returns empty array when q is only whitespace", async () => {
    const res = await GET(makeRequest("  "));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("queries database when q is at least 2 characters", async () => {
    const clients = [
      { id: "1", name: "Jean", phone: "4181234567", email: "jean@example.com" },
    ];
    const chain = mockChain({ data: clients, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await GET(makeRequest("Je"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("Jean");
  });

  it("uses ilike for case-insensitive name and phone search", async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await GET(makeRequest("jean"));
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("name.ilike.%jean%")
    );
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("phone.ilike.%jean%")
    );
  });

  it("limits results to 10", async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await GET(makeRequest("test"));
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it("returns empty array (not null) when database returns null data", async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await GET(makeRequest("test"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("returns 500 with error message when database query fails", async () => {
    const chain = mockChain({ data: null, error: { message: "DB connection failed" } });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await GET(makeRequest("jean"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/DB connection failed/);
  });

  it("trims whitespace from the search term before querying", async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await GET(makeRequest("  Jean  "));
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("name.ilike.%Jean%")
    );
  });
});
