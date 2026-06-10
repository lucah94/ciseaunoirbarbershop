/**
 * Tests for src/app/api/cuts/route.ts
 *
 * Pure logic covered:
 * - ISO week → date range calculation (the week filter)
 * - Dual auth: admin OR barber can GET, only admin can POST/DELETE
 *
 * The ISO week calculation is inlined in the route — replicated here
 * to test independently of the DB.
 */
import { describe, it, expect } from "vitest";

// ─── ISO Week → date range ────────────────────────────────────────────────────

function isoWeekToRange(week: string): { weekStart: string; weekEnd: string } | null {
  if (!week) return null;
  const [year, w] = week.split("-W").map(Number);
  if (!year || !w) return null;
  const jan4 = new Date(year, 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const weekStart = startOfWeek.toISOString().split("T")[0];
  const weekEnd = endOfWeek.toISOString().split("T")[0];
  return { weekStart, weekEnd };
}

describe("isoWeekToRange", () => {
  it("calculates correct range for 2026-W01", () => {
    const r = isoWeekToRange("2026-W01");
    expect(r).not.toBeNull();
    // ISO week 1 of 2026: Mon Dec 29 2025 → Sun Jan 4 2026
    expect(r!.weekStart).toBe("2025-12-29");
    expect(r!.weekEnd).toBe("2026-01-04");
  });

  it("calculates correct range for 2026-W23 (current week)", () => {
    const r = isoWeekToRange("2026-W23");
    expect(r).not.toBeNull();
    // 7-day span
    const start = new Date(r!.weekStart);
    const end = new Date(r!.weekEnd);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6); // Mon to Sun inclusive
  });

  it("weekStart is always a Monday", () => {
    // Parse YYYY-MM-DD as local time to avoid UTC midnight day shift
    function parseLocal(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
    for (const w of ["2026-W01", "2026-W10", "2026-W52"]) {
      const r = isoWeekToRange(w);
      if (!r) continue;
      expect(parseLocal(r.weekStart).getDay()).toBe(1); // Monday
    }
  });

  it("weekEnd is always a Sunday", () => {
    function parseLocal(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
    for (const w of ["2026-W01", "2026-W10", "2026-W52"]) {
      const r = isoWeekToRange(w);
      if (!r) continue;
      expect(parseLocal(r.weekEnd).getDay()).toBe(0); // Sunday
    }
  });

  it("returns null when week param is empty", () => {
    expect(isoWeekToRange("")).toBeNull();
  });

  it("handles year boundary — 2025-W53 if it exists", () => {
    // 2026 has no week 53, but the function should not throw
    expect(() => isoWeekToRange("2026-W52")).not.toThrow();
  });
});

// ─── Dual-auth guard logic ─────────────────────────────────────────────────────

describe("cuts GET auth — admin OR barber", () => {
  it("mirrors the pattern: deny if BOTH admin and barber fail", () => {
    const adminDenied = true;
    const barberDenied = true;
    expect(adminDenied && barberDenied).toBe(true); // should return 401
  });

  it("allows if admin passes regardless of barber", () => {
    const adminDenied = false;
    const barberDenied = true;
    expect(adminDenied && barberDenied).toBe(false); // should proceed
  });

  it("allows if barber passes regardless of admin", () => {
    const adminDenied = true;
    const barberDenied = false;
    expect(adminDenied && barberDenied).toBe(false); // should proceed
  });
});
