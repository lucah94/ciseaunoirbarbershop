/**
 * Tests for src/app/api/expenses/route.ts
 *
 * Covers: admin auth guard on all methods, GET list, POST insert, DELETE.
 * The analyze route (expenses/analyze) is a separate AI-heavy endpoint
 * tested via todos here.
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
  mockRequireAdmin.mockReturnValue(null); // authorized by default
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("expenses auth guard", () => {
  it.todo("GET returns 401 when requireAdmin returns a 401 response");

  it.todo("POST returns 401 when requireAdmin returns a 401 response");

  it.todo("DELETE returns 401 when requireAdmin returns a 401 response");
});

// ─── GET /api/expenses ────────────────────────────────────────────────────────

describe("GET /api/expenses", () => {
  it.todo("returns all expenses ordered by date descending");

  it.todo("returns up to 10,000 rows (range 0-9999)");

  it.todo("returns 500 with error message when Supabase query fails");

  it.todo("returns an empty array when no expenses exist");
});

// ─── POST /api/expenses ───────────────────────────────────────────────────────

describe("POST /api/expenses", () => {
  it.todo("inserts the expense body into the expenses table and returns the created record");

  it.todo("returns 500 when Supabase insert fails");

  it.todo("does NOT validate body fields — any object is inserted as-is (documented gap)");
});

// ─── DELETE /api/expenses ─────────────────────────────────────────────────────

describe("DELETE /api/expenses", () => {
  it.todo("deletes the expense by id from query string and returns { success: true }");

  it.todo("returns 500 when Supabase delete fails");

  it.todo("does NOT return 400 when id is missing — deletes with eq('id', null) (documented gap)");
});

// ─── POST /api/expenses/analyze ───────────────────────────────────────────────

describe("POST /api/expenses/analyze (AI receipt parsing)", () => {
  it.todo("returns 400 when no files are provided in form data");

  it.todo("uploads each file to Supabase Storage 'receipts' bucket");

  it.todo("calls Claude Vision with the file as base64 image");

  it.todo("parses the AI JSON response and extracts description, amount, category, date");

  it.todo("falls back to default values when JSON parse fails");

  it.todo("only accepts categories from the predefined CATEGORIES list");

  it.todo("returns an array of extracted expense objects with receipt_url");

  it.todo("returns 500 when Supabase storage upload fails");
});
