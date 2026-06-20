import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockReturnValue(null) }));

function makeInsertChain(result: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(result),
  };
}

function makeUpdateChain(result: unknown) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(result),
  };
}

function makePostReq(body: Record<string, unknown>) {
  return new Request("https://ciseaunoirbarbershop.com/api/bookings/recurring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(groupId?: string) {
  const url = groupId
    ? `https://ciseaunoirbarbershop.com/api/bookings/recurring?group_id=${groupId}`
    : "https://ciseaunoirbarbershop.com/api/bookings/recurring";
  return new Request(url, { method: "DELETE" });
}

beforeEach(() => vi.resetAllMocks());

const validBody = {
  client_name: "Jean Tremblay",
  client_phone: "4186655703",
  client_email: "jean@test.com",
  barber: "Melynda",
  service: "Coupe homme",
  price: 35,
  date: "2026-07-01",
  time: "10:00",
  recurrence_pattern: "weekly",
  recurrence_count: 4,
};

describe("POST /api/bookings/recurring", () => {
  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) as ReturnType<typeof requireAdmin>
    );
    const { POST } = await import("@/app/api/bookings/recurring/route");
    const res = await POST(makePostReq(validBody) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/bookings/recurring/route");
    const res = await POST(makePostReq({ client_name: "Jean" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("creates recurrence_count bookings for weekly pattern", async () => {
    const insertedRows = Array.from({ length: 4 }, (_, i) => ({ id: `id-${i}`, date: "" }));
    const chain = makeInsertChain({ data: insertedRows, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { POST } = await import("@/app/api/bookings/recurring/route");
    const res = await POST(makePostReq(validBody) as Parameters<typeof POST>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(4);
    expect(body.group_id).toBeTruthy();
  });

  it("generates dates spaced 1 week apart for weekly pattern", async () => {
    let captured: unknown[] = [];
    const chain = {
      insert: vi.fn((rows: unknown[]) => { captured = rows; return chain; }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { POST } = await import("@/app/api/bookings/recurring/route");
    await POST(makePostReq({ ...validBody, recurrence_count: 3 }) as Parameters<typeof POST>[0]);

    const dates = (captured as Array<{ date: string }>).map((b) => b.date);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[1]).toBe("2026-07-08");
    expect(dates[2]).toBe("2026-07-15");
  });

  it("generates dates spaced 2 weeks apart for biweekly pattern", async () => {
    let captured: unknown[] = [];
    const chain = {
      insert: vi.fn((rows: unknown[]) => { captured = rows; return chain; }),
      select: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { POST } = await import("@/app/api/bookings/recurring/route");
    await POST(makePostReq({ ...validBody, recurrence_pattern: "biweekly", recurrence_count: 2 }) as Parameters<typeof POST>[0]);

    const dates = (captured as Array<{ date: string }>).map((b) => b.date);
    expect(dates[1]).toBe("2026-07-15");
  });

  it("assigns the same recurring_group_id to all bookings", async () => {
    let captured: unknown[] = [];
    const chain = {
      insert: vi.fn((rows: unknown[]) => { captured = rows; return chain; }),
      select: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { POST } = await import("@/app/api/bookings/recurring/route");
    await POST(makePostReq(validBody) as Parameters<typeof POST>[0]);

    const groupIds = new Set((captured as Array<{ recurring_group_id: string }>).map((b) => b.recurring_group_id));
    expect(groupIds.size).toBe(1);
  });

  it("returns 500 on Supabase insert error", async () => {
    const chain = makeInsertChain({ data: null, error: { message: "DB error" } });
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { POST } = await import("@/app/api/bookings/recurring/route");
    const res = await POST(makePostReq(validBody) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/bookings/recurring", () => {
  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) as ReturnType<typeof requireAdmin>
    );
    const { DELETE } = await import("@/app/api/bookings/recurring/route");
    const res = await DELETE(makeDeleteReq("some-group") as Parameters<typeof DELETE>[0]);
    expect(res.status).toBe(403);
  });

  it("returns 400 when group_id is missing", async () => {
    const { DELETE } = await import("@/app/api/bookings/recurring/route");
    const res = await DELETE(makeDeleteReq() as Parameters<typeof DELETE>[0]);
    expect(res.status).toBe(400);
  });

  it("cancels only future confirmed bookings for the group", async () => {
    const chain = makeUpdateChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { DELETE } = await import("@/app/api/bookings/recurring/route");
    const res = await DELETE(makeDeleteReq("group-abc") as Parameters<typeof DELETE>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // Verify status filter was applied
    expect((chain.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(["status", "confirmed"]);
  });

  it("returns 500 on Supabase error", async () => {
    const chain = makeUpdateChain({ error: { message: "DB error" } });
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

    const { DELETE } = await import("@/app/api/bookings/recurring/route");
    const res = await DELETE(makeDeleteReq("group-xyz") as Parameters<typeof DELETE>[0]);
    expect(res.status).toBe(500);
  });
});
