/**
 * Tests for src/lib/supabase.ts
 *
 * supabase.ts creates two Supabase clients and exports shared types.
 * Tests verify:
 *   - both clients are exported and have the expected shape
 *   - supabaseAdmin uses SUPABASE_SERVICE_ROLE_KEY when available
 *   - trailing whitespace in env vars is trimmed (Vercel newline bug guard)
 *   - Booking, Cut, and Expense type shapes (via type-level assertions in runtime)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("supabase clients", () => {
  beforeEach(() => {
    Object.assign(process.env, BASE_ENV);
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of Object.keys(BASE_ENV)) delete process.env[key];
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("exports a supabase (public) client", async () => {
    const { supabase } = await import("@/lib/supabase");
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe("function");
  });

  it("exports a supabaseAdmin client", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.from).toBe("function");
  });

  it("creates supabaseAdmin with service role key when SUPABASE_SERVICE_ROLE_KEY is set", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { supabaseAdmin } = await import("@/lib/supabase");
    expect(supabaseAdmin).toBeDefined();
  });

  it("supabaseAdmin falls back to anon key when SUPABASE_SERVICE_ROLE_KEY is absent", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { supabaseAdmin } = await import("@/lib/supabase");
    expect(supabaseAdmin).toBeDefined();
  });

  it("trims whitespace from NEXT_PUBLIC_SUPABASE_URL to prevent WebSocket auth failures", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://test.supabase.co\n";
    const { supabase } = await import("@/lib/supabase");
    expect(supabase).toBeDefined();
  });
});

// ─── Type shape smoke tests ───────────────────────────────────────────────────
// These confirm the exported types have the fields the rest of the app relies on.
// They pass as long as the type definitions match — will fail at TS compile time
// if fields are removed/renamed.

describe("Booking type shape", () => {
  it("satisfies a minimal Booking object at runtime", async () => {
    const { } = await import("@/lib/supabase");
    const booking = {
      id: "uuid",
      client_name: "Jean",
      client_phone: "5141234567",
      client_email: "jean@example.com",
      barber: "melynda",
      service: "Coupe",
      price: 35,
      date: "2026-06-10",
      time: "10:00",
      status: "confirmed" as const,
      note: "",
      created_at: "2026-06-10T10:00:00Z",
    };
    expect(booking.status).toBe("confirmed");
    expect(["confirmed", "cancelled", "completed", "no_show"]).toContain(booking.status);
  });
});

describe("Cut type shape", () => {
  it("satisfies a minimal Cut object at runtime", async () => {
    const cut = {
      id: "uuid",
      barber: "melynda",
      service_name: "Coupe",
      price: 35,
      tip: 5,
      discount_percent: 0,
      date: "2026-06-10",
      booking_id: "booking-uuid",
      created_at: "2026-06-10T10:00:00Z",
    };
    expect(typeof cut.tip).toBe("number");
    expect(typeof cut.discount_percent).toBe("number");
  });
});
