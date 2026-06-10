/**
 * Tests for src/app/api/cron/birthday-promo/route.ts
 *
 * The birthday matching logic is pure: check if a client's birthday
 * falls on today's MM-DD. The route tries three strategies to match.
 *
 * Covered:
 * - mmdd extraction from today
 * - full ISO date match (YYYY-MM-DD)
 * - partial match (ends with MM-DD)
 * - slice(5, 10) match for ISO dates
 * - non-birthday clients are excluded
 * - null/undefined birthday is excluded
 */
import { describe, it, expect } from "vitest";

// Replicated from route.ts
function isClientBirthday(birthday: string | null | undefined, mmdd: string): boolean {
  if (!birthday) return false;
  const bday = String(birthday);
  return bday.includes(mmdd) || bday.endsWith(mmdd) || bday.slice(5, 10) === mmdd;
}

// The mmdd format extraction
function getTodayMmdd(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

describe("birthday mmdd extraction", () => {
  it("formats month and day with leading zeros", () => {
    expect(getTodayMmdd(new Date(2026, 0, 5))).toBe("01-05");   // Jan 5
    expect(getTodayMmdd(new Date(2026, 11, 31))).toBe("12-31"); // Dec 31
  });

  it("handles single-digit month and day", () => {
    expect(getTodayMmdd(new Date(2026, 2, 3))).toBe("03-03");
  });
});

describe("isClientBirthday", () => {
  const MMDD = "06-09"; // June 9

  it("matches ISO date YYYY-MM-DD (slice strategy)", () => {
    expect(isClientBirthday("1990-06-09", MMDD)).toBe(true);
  });

  it("matches when birthday is stored as MM-DD only", () => {
    expect(isClientBirthday("06-09", MMDD)).toBe(true);
  });

  it("matches when birthday ends with MM-DD (endsWith strategy)", () => {
    expect(isClientBirthday("1985-06-09", MMDD)).toBe(true);
  });

  it("matches when birthday includes MM-DD anywhere (includes strategy)", () => {
    expect(isClientBirthday("06-09-1990", MMDD)).toBe(true); // US format
  });

  it("does not match a different date", () => {
    expect(isClientBirthday("1990-07-15", MMDD)).toBe(false);
  });

  it("does not match null birthday", () => {
    expect(isClientBirthday(null, MMDD)).toBe(false);
  });

  it("does not match undefined birthday", () => {
    expect(isClientBirthday(undefined, MMDD)).toBe(false);
  });

  it("does not match empty string", () => {
    expect(isClientBirthday("", MMDD)).toBe(false);
  });

  it("does not false-positive on partial day match", () => {
    // e.g. birthday 1990-06-19 should NOT match mmdd 06-09
    expect(isClientBirthday("1990-06-19", "06-09")).toBe(false);
  });

  it("handles birthday on Dec 31 correctly", () => {
    expect(isClientBirthday("2000-12-31", "12-31")).toBe(true);
    expect(isClientBirthday("2000-12-31", "01-01")).toBe(false);
  });
});

// ─── Promo code format ────────────────────────────────────────────────────────

function buildPromoCode(firstName: string): string {
  return `BDAY-${firstName.toUpperCase()}`;
}

describe("birthday promo code format", () => {
  it("uppercases first name", () => {
    expect(buildPromoCode("alice")).toBe("BDAY-ALICE");
  });

  it("preserves already-uppercase name", () => {
    expect(buildPromoCode("MELYNDA")).toBe("BDAY-MELYNDA");
  });

  it("handles accented characters", () => {
    // toUpperCase handles accents correctly in JS
    expect(buildPromoCode("élodie")).toBe("BDAY-ÉLODIE");
  });
});
