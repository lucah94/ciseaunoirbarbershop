/**
 * Tests for src/app/api/bookings/[id]/cancel/route.ts
 *
 * The route is unauthenticated — any caller with a booking ID can cancel it
 * (IDOR risk). Tests verify the guard conditions and HTML response shapes.
 * The route returns HTML pages (not JSON), so assertions check Content-Type
 * and body strings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

function makeRequest(id: string) {
  return new Request(`https://ciseaunoirbarbershop.com/api/bookings/${id}/cancel`);
}

function makeChain(returnValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    update: vi.fn().mockReturnThis(),
  };
}

beforeEach(() => vi.resetAllMocks());

describe("GET /api/bookings/[id]/cancel", () => {
  it("returns text/html Content-Type in all responses", async () => {
    const chain = makeChain({ data: null, error: { message: "not found" } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("unknown-id") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "unknown-id" }),
    });

    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("returns 404 HTML page for unknown booking ID", async () => {
    const chain = makeChain({ data: null, error: { message: "not found" } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("bad-id") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.text();

    expect(body).toContain("introuvable");
  });

  it("returns 'already cancelled' HTML page when status is 'cancelled'", async () => {
    const booking = {
      id: "abc",
      client_name: "Jean",
      service: "Coupe",
      barber: "Melynda",
      date: "2099-01-01",
      time: "10:00",
      status: "cancelled",
    };
    const chain = makeChain({ data: booking, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("abc") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "abc" }),
    });
    const body = await res.text();

    expect(body).toContain("annulé");
    expect(body).not.toContain("Reprendre");
  });

  it("returns 'past booking' HTML page when booking date is in the past", async () => {
    const booking = {
      id: "abc",
      client_name: "Jean",
      service: "Coupe",
      barber: "Melynda",
      date: "2020-01-01",
      time: "10:00",
      status: "confirmed",
    };
    const chain = makeChain({ data: booking, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("abc") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "abc" }),
    });
    const body = await res.text();

    expect(body).toContain("Rendez-vous passé");
  });

  it("cancels a valid future booking and returns success HTML", async () => {
    const booking = {
      id: "future-abc",
      client_name: "Jean",
      service: "Coupe homme",
      barber: "Stéphanie",
      date: "2099-12-31",
      time: "14:00",
      status: "confirmed",
    };

    const selectChain = makeChain({ data: booking, error: null });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(selectChain as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValue(updateChain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("future-abc") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "future-abc" }),
    });
    const body = await res.text();

    expect(body).toContain("annulé");
    expect(body).toContain("Reprendre un rendez-vous");
    expect(body).toContain("Coupe homme");
    expect(body).toContain("Stéphanie");
  });

  it("success HTML includes the barber name", async () => {
    const booking = {
      id: "xyz",
      client_name: "Marie",
      service: "Barbe",
      barber: "Melynda",
      date: "2099-06-15",
      time: "09:00",
      status: "confirmed",
    };

    const selectChain = makeChain({ data: booking, error: null });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(selectChain as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValue(updateChain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("xyz") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "xyz" }),
    });
    const body = await res.text();

    expect(body).toContain("Melynda");
  });

  // Security: no auth required — any ID can cancel any booking
  it("cancels booking without any authentication token (IDOR — unauthenticated access works)", async () => {
    const booking = {
      id: "idor-test",
      client_name: "Autre",
      service: "Coupe",
      barber: "Melynda",
      date: "2099-01-01",
      time: "10:00",
      status: "confirmed",
    };

    const selectChain = makeChain({ data: booking, error: null });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(selectChain as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValue(updateChain as ReturnType<typeof supabaseAdmin.from>);

    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("idor-test") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "idor-test" }),
    });
    const body = await res.text();

    // This test documents the current behavior (unauthenticated cancel succeeds).
    // Fix: add a signed token param tied to client_phone/email before processing.
    expect(body).toContain("annulé");
  });
});
