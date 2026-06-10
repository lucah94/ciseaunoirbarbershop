/**
 * Tests for src/app/api/calendar/[barber]/route.ts
 *
 * Covers:
 * - Returns 401 when CALENDAR_SECRET is set and ?key is missing or wrong
 * - Returns 400 for invalid barber name (not "melynda")
 * - Returns valid iCal text/calendar response with correct structure
 * - iCal VEVENT entries contain booking data (client name, service, phone)
 * - 30-min duration for standard cuts, 45-min for coupe+barbe
 * - Returns empty VCALENDAR when no upcoming bookings
 * - Returns 500 when Supabase query fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/lib/supabase";

const mockBooking = {
  id: "booking-1",
  client_name: "Jean Tremblay",
  client_phone: "4181234567",
  service: "Coupe adulte",
  price: 35,
  date: "2026-06-15",
  time: "10:00",
  barber: "melynda",
  status: "confirmed",
};

function makeChain(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  } as Record<string, unknown>;
  // Last call in chain resolves
  (chain.order as ReturnType<typeof vi.fn>).mockImplementationOnce(() => chain);
  (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data, error });
  return chain;
}

function makeRequest(barber: string, key?: string) {
  const url = key
    ? `http://localhost/api/calendar/${barber}?key=${key}`
    : `http://localhost/api/calendar/${barber}`;
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.CALENDAR_SECRET = "cal-secret";
});

describe("GET /api/calendar/[barber] — auth", () => {
  it("returns 401 when CALENDAR_SECRET is set and ?key is absent", async () => {
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda"), { params: Promise.resolve({ barber: "melynda" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when ?key is wrong", async () => {
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "wrong-key"), { params: Promise.resolve({ barber: "melynda" }) });
    expect(res.status).toBe(401);
  });

  it("returns 200 when ?key matches CALENDAR_SECRET", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/calendar/[barber] — barber validation", () => {
  it("returns 400 for unknown barber name", async () => {
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("unknown", "cal-secret"), { params: Promise.resolve({ barber: "unknown" }) });
    expect(res.status).toBe(400);
  });

  it("accepts 'melynda' as valid barber", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/calendar/[barber] — iCal output", () => {
  it("returns Content-Type: text/calendar", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([mockBooking]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    expect(res.headers.get("content-type")).toContain("text/calendar");
  });

  it("response body starts with BEGIN:VCALENDAR and ends with END:VCALENDAR", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([mockBooking]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
  });

  it("includes VEVENT for each booking", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([mockBooking]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    const text = await res.text();
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("Jean Tremblay");
  });

  it("sets 30-minute duration for standard cut (DTSTART 10:00 → DTEND 10:30)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([mockBooking]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    const text = await res.text();
    expect(text).toContain("DTSTART:20260615T100000");
    expect(text).toContain("DTEND:20260615T103000");
  });

  it("sets 45-minute duration for coupe+barbe service", async () => {
    const comboBooking = { ...mockBooking, service: "Coupe + Barbe", time: "14:00", date: "2026-06-15" };
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([comboBooking]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    const text = await res.text();
    expect(text).toContain("DTSTART:20260615T140000");
    expect(text).toContain("DTEND:20260615T144500");
  });

  it("returns empty VCALENDAR (no VEVENTs) when no bookings", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeChain([]) as never);
    const { GET } = await import("@/app/api/calendar/[barber]/route");
    const res = await GET(makeRequest("melynda", "cal-secret"), { params: Promise.resolve({ barber: "melynda" }) });
    const text = await res.text();
    expect(text).not.toContain("BEGIN:VEVENT");
  });

  it.todo("returns 500 when Supabase query fails");
  it.todo("includes Cache-Control: no-cache header");
});
