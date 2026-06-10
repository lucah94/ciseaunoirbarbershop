/**
 * Tests for src/app/api/admin/blocks/route.ts
 *
 * Covers: GET (admin OR barber auth), POST/PATCH/DELETE (admin only),
 * barber filter param, CRUD operations and error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

import { requireAdmin } from "@/lib/auth";

const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockReturnValue(null);
});

// ─── GET /api/admin/blocks ────────────────────────────────────────────────────

describe("GET /api/admin/blocks", () => {
  it.todo("returns all blocks ordered by date when admin cookie is valid");

  it.todo("returns blocks filtered by 'barber' query param when provided");

  it.todo("returns all blocks (no filter) when 'barber' query param is absent");

  it.todo("allows access with valid barber_auth cookie even when admin auth fails");

  it.todo("returns 401 when neither admin nor barber cookie is set");

  it.todo("returns 500 when Supabase query fails");

  it.todo("returns empty array [] when no blocks exist for the given barber");
});

// ─── POST /api/admin/blocks ───────────────────────────────────────────────────

describe("POST /api/admin/blocks", () => {
  it.todo("returns 401 when admin auth fails");

  it.todo("inserts a block with barber, date, reason, start_time, end_time and returns created record");

  it.todo("stores reason as null when not provided in body");

  it.todo("stores start_time as null when not provided in body");

  it.todo("stores end_time as null when not provided in body");

  it.todo("returns 500 when Supabase insert fails");
});

// ─── PATCH /api/admin/blocks ──────────────────────────────────────────────────

describe("PATCH /api/admin/blocks", () => {
  it.todo("returns 401 when admin auth fails");

  it.todo("returns 400 when 'id' is not provided in body");

  it.todo("updates the block fields (excluding id) and returns updated record");

  it.todo("returns 500 when Supabase update fails");
});

// ─── DELETE /api/admin/blocks ─────────────────────────────────────────────────

describe("DELETE /api/admin/blocks", () => {
  it.todo("returns 401 when admin auth fails");

  it.todo("deletes block by id from request body and returns { ok: true }");

  it.todo("returns 500 when Supabase delete fails");
});
