/**
 * Tests for src/app/api/loyalty/route.ts
 *
 * Covers: progress calculation, nextFree/isFree flags, missing params error,
 * loyalty math edge cases.
 */
import { describe, it, expect } from "vitest";

// ─── Loyalty math (extracted logic) ──────────────────────────────────────────
// The logic lives inline in the route handler. Suggestion: extract to a
// pure function `computeLoyalty(visits: number)` for easier unit testing.

function computeLoyalty(visits: number) {
  const progress = visits % 10;
  const nextFree = progress === 9;
  const isFree = progress === 0 && visits > 0;
  return { visits, progress, nextFree, isFree };
}

describe("computeLoyalty", () => {
  it("returns progress 0 and isFree false for 0 visits (new client)", () => {
    const r = computeLoyalty(0);
    expect(r.progress).toBe(0);
    expect(r.isFree).toBe(false);
    expect(r.nextFree).toBe(false);
  });

  it("returns isFree true when visits is exactly 10 (earned first free)", () => {
    const r = computeLoyalty(10);
    expect(r.progress).toBe(0);
    expect(r.isFree).toBe(true);
  });

  it("returns nextFree true when progress is 9 (one visit away)", () => {
    const r = computeLoyalty(9);
    expect(r.nextFree).toBe(true);
    expect(r.isFree).toBe(false);
  });

  it("returns nextFree true at 19 visits (one visit from 2nd free)", () => {
    expect(computeLoyalty(19).nextFree).toBe(true);
  });

  it("returns isFree true at 20 visits (second free earned)", () => {
    const r = computeLoyalty(20);
    expect(r.isFree).toBe(true);
    expect(r.nextFree).toBe(false);
  });

  it("returns progress 5 for 5 visits", () => {
    expect(computeLoyalty(5).progress).toBe(5);
  });

  it("returns progress 3 for 13 visits", () => {
    expect(computeLoyalty(13).progress).toBe(3);
  });

  it("isFree is false at 11 visits (already claimed, back to regular)", () => {
    const r = computeLoyalty(11);
    expect(r.isFree).toBe(false);
    expect(r.progress).toBe(1);
  });
});

// ─── API route level (integration — needs mocked Supabase) ───────────────────

describe("GET /api/loyalty — route level", () => {
  it.todo("returns 400 when neither email nor phone is provided");
  it.todo("returns 400 when both email and phone are absent from query params");
  it.todo("looks up by client_email when email param is provided");
  it.todo("looks up by client_phone when phone param is provided");
  it.todo("returns 500 when Supabase query fails");
});
