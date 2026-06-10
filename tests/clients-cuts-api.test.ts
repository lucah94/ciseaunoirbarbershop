/**
 * Tests for:
 *  - src/app/api/clients/route.ts   (GET/POST/PATCH clients)
 *  - src/app/api/cuts/route.ts      (GET/POST cuts — affects payroll)
 *
 * Neither route has a test file. Clients are used for loyalty, dedupe, and
 * email marketing. Cuts are the source of truth for barber payroll.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

import { supabaseAdmin as supabase } from "@/lib/supabase";

beforeEach(() => vi.resetAllMocks());

// ─── GET /api/clients ─────────────────────────────────────────────────────────

describe("GET /api/clients", () => {
  it.todo("returns list of all clients from Supabase");

  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("filters by barber query param when provided");

  it.todo("returns 500 on Supabase error");
});

// ─── POST /api/clients ────────────────────────────────────────────────────────

describe("POST /api/clients", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("inserts new client and returns the created record");

  it.todo("returns 400 when required fields are missing");

  it.todo("returns 500 on Supabase insert error");
});

// ─── PATCH /api/clients ───────────────────────────────────────────────────────

describe("PATCH /api/clients", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("returns 400 when id is missing");

  it.todo("updates client record and returns updated data");

  it.todo("returns 500 on Supabase update error");
});

// ─── GET /api/cuts ────────────────────────────────────────────────────────────

describe("GET /api/cuts", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("returns cuts filtered by barber and date range from query params");

  it.todo("returns all cuts when no filter params provided");

  it.todo("returns 500 on Supabase error");
});

// ─── POST /api/cuts ───────────────────────────────────────────────────────────

describe("POST /api/cuts", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("inserts cut record with barber, service_name, price, tip, date");

  it.todo("returns 400 when required fields are missing");

  it.todo("returns 500 on Supabase insert error");

  it.todo("links cut to booking_id when provided");
});

// ─── DELETE /api/cuts ─────────────────────────────────────────────────────────

describe("DELETE /api/cuts", () => {
  it.todo("returns 401 when requireAdmin denies the request");

  it.todo("deletes cut by id and returns success");

  it.todo("returns 400 when id is missing");
});
