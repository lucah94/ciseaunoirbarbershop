/**
 * Tests for src/app/api/bookings/no-show/route.ts
 *
 * Covers: missing id, booking not found, wrong status guard,
 * successful no-show update, SMS/email side-effects.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/email", () => ({
  sendNoShowAdminNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendNoShowSMS: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendNoShowAdminNotification } from "@/lib/email";
import { sendNoShowSMS } from "@/lib/sms";
import { POST } from "@/app/api/bookings/no-show/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/bookings/no-show", {
    method: "POST",
    // La route exige maintenant une auth admin/barbier (cookie). "true" = jeton legacy accepté.
    headers: { "Content-Type": "application/json", cookie: "admin_auth=true" },
    body: JSON.stringify(body),
  });
}

function mockChain(returnValue: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), update: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(returnValue);
  chain.update.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/bookings/no-show", () => {
  it("returns 400 when id is missing from body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/id/i);
  });

  it("returns 404 when booking does not exist", async () => {
    const chain = mockChain({ data: null, error: { message: "not found" } });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makeRequest({ id: "nonexistent-uuid" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when booking status is not 'confirmed'", async () => {
    const fetchChain = mockChain({
      data: { id: "abc", status: "completed", client_name: "Jean", client_phone: null },
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(fetchChain);

    const res = await POST(makeRequest({ id: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/confirm/i);
  });

  it("returns 400 when booking status is 'cancelled'", async () => {
    const fetchChain = mockChain({
      data: { id: "abc", status: "cancelled", client_name: "Jean", client_phone: null },
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(fetchChain);

    const res = await POST(makeRequest({ id: "abc" }));
    expect(res.status).toBe(400);
  });

  it("updates status to no_show and returns the updated booking", async () => {
    const booking = {
      id: "abc",
      status: "confirmed",
      client_name: "Jean Tremblay",
      client_phone: null,
      client_email: "jean@example.com",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-10",
      time: "10:00",
    };
    const updatedBooking = { ...booking, status: "no_show" };

    const fromMock = vi.fn();
    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: fetch booking
        return mockChain({ data: booking, error: null });
      }
      // Second call: update
      return mockChain({ data: updatedBooking, error: null });
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

    const res = await POST(makeRequest({ id: "abc" }));
    expect(res.status).toBe(200);
  });

  it("sends no-show SMS when client has phone and Twilio is configured", async () => {
    const booking = {
      id: "abc",
      status: "confirmed",
      client_name: "Jean",
      client_phone: "4181234567",
      client_email: null,
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-10",
      time: "10:00",
    };
    const originalEnv = process.env.TWILIO_ACCOUNT_SID;
    process.env.TWILIO_ACCOUNT_SID = "ACtest";

    const fromMock = vi.fn();
    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? mockChain({ data: booking, error: null })
        : mockChain({ data: { ...booking, status: "no_show" }, error: null });
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

    await POST(makeRequest({ id: "abc" }));
    expect(sendNoShowSMS).toHaveBeenCalledWith({
      client_name: "Jean",
      client_phone: "4181234567",
    });

    process.env.TWILIO_ACCOUNT_SID = originalEnv;
  });

  it("skips SMS when client has no phone", async () => {
    const booking = {
      id: "abc",
      status: "confirmed",
      client_name: "Jean",
      client_phone: null,
      client_email: "jean@example.com",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-10",
      time: "10:00",
    };

    const fromMock = vi.fn();
    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? mockChain({ data: booking, error: null })
        : mockChain({ data: { ...booking, status: "no_show" }, error: null });
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

    await POST(makeRequest({ id: "abc" }));
    expect(sendNoShowSMS).not.toHaveBeenCalled();
  });

  it("always sends admin email notification on successful no-show", async () => {
    const booking = {
      id: "abc",
      status: "confirmed",
      client_name: "Jean",
      client_phone: null,
      client_email: "jean@example.com",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-10",
      time: "10:00",
    };

    const fromMock = vi.fn();
    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? mockChain({ data: booking, error: null })
        : mockChain({ data: { ...booking, status: "no_show" }, error: null });
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

    await POST(makeRequest({ id: "abc" }));
    expect(sendNoShowAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: "Jean", service: "Coupe" })
    );
  });

  it("returns 500 when supabase update fails", async () => {
    const booking = {
      id: "abc",
      status: "confirmed",
      client_name: "Jean",
      client_phone: null,
      client_email: null,
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-10",
      time: "10:00",
    };

    const fetchChain = mockChain({ data: booking, error: null });
    const updateChain = mockChain({ data: null, error: { message: "DB error" } });

    const fromMock = vi.fn();
    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? fetchChain : updateChain;
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

    const res = await POST(makeRequest({ id: "abc" }));
    expect(res.status).toBe(500);
  });
});
