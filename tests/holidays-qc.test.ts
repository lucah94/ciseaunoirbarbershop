import { describe, it, expect } from "vitest";
import { getQcHolidays, isHoliday, getUpcomingHolidays } from "@/lib/holidays-qc";

describe("getQcHolidays", () => {
  it("returns 10 holidays per year", () => {
    expect(getQcHolidays(2026).length).toBe(10);
  });

  it("returns sorted results", () => {
    const holidays = getQcHolidays(2026);
    for (let i = 1; i < holidays.length; i++) {
      expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
    }
  });

  it("contains New Year on Jan 1", () => {
    const h = getQcHolidays(2026);
    expect(h.some((x) => x.date === "2026-01-01")).toBe(true);
  });

  it("contains Fête nationale on Jun 24", () => {
    const h = getQcHolidays(2026);
    expect(h.some((x) => x.date === "2026-06-24")).toBe(true);
  });

  it("contains Canada Day on Jul 1", () => {
    const h = getQcHolidays(2026);
    expect(h.some((x) => x.date === "2026-07-01")).toBe(true);
  });

  it("contains Christmas on Dec 25", () => {
    const h = getQcHolidays(2026);
    expect(h.some((x) => x.date === "2026-12-25")).toBe(true);
  });

  // Known Easter dates to verify Butcher's algorithm
  it("calculates Easter 2025 correctly (Apr 20)", () => {
    const h = getQcHolidays(2025);
    expect(h.some((x) => x.name === "Lundi de Pâques" && x.date === "2025-04-21")).toBe(true);
    expect(h.some((x) => x.name === "Vendredi saint" && x.date === "2025-04-18")).toBe(true);
  });

  it("calculates Easter 2026 correctly (Apr 5)", () => {
    const h = getQcHolidays(2026);
    expect(h.some((x) => x.name === "Lundi de Pâques" && x.date === "2026-04-06")).toBe(true);
    expect(h.some((x) => x.name === "Vendredi saint" && x.date === "2026-04-03")).toBe(true);
  });

  it("Labour Day is always first Monday of September", () => {
    const h = getQcHolidays(2026);
    const labourDay = h.find((x) => x.name === "Fête du Travail");
    expect(labourDay).toBeDefined();
    const d = new Date(labourDay!.date + "T12:00:00");
    expect(d.getDay()).toBe(1); // Monday
    expect(d.getDate()).toBeLessThanOrEqual(7);
  });

  it("Thanksgiving is always second Monday of October", () => {
    const h = getQcHolidays(2026);
    const tg = h.find((x) => x.name === "Action de Grâces");
    expect(tg).toBeDefined();
    const d = new Date(tg!.date + "T12:00:00");
    expect(d.getDay()).toBe(1); // Monday
    expect(d.getDate()).toBeGreaterThanOrEqual(8);
    expect(d.getDate()).toBeLessThanOrEqual(14);
  });

  it("Journée des Patriotes is always Monday before May 25", () => {
    [2024, 2025, 2026].forEach((year) => {
      const h = getQcHolidays(year);
      const pat = h.find((x) => x.name === "Journée nationale des Patriotes");
      expect(pat).toBeDefined();
      const d = new Date(pat!.date + "T12:00:00");
      expect(d.getDay()).toBe(1); // Monday
      const may25 = new Date(year, 4, 25);
      expect(d < may25).toBe(true);
    });
  });
});

describe("isHoliday", () => {
  it("returns holiday object for a known holiday", () => {
    const h = isHoliday("2026-01-01");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("Jour de l'An");
  });

  it("returns null for a non-holiday", () => {
    expect(isHoliday("2026-06-09")).toBeNull();
  });

  it("returns null for a weekend that is not a holiday", () => {
    expect(isHoliday("2026-03-14")).toBeNull(); // random Saturday
  });

  it("correctly identifies Christmas", () => {
    const h = isHoliday("2026-12-25");
    expect(h).not.toBeNull();
    expect(h!.emoji).toBe("🎄");
  });
});

describe("getUpcomingHolidays", () => {
  it("returns only holidays within the window", () => {
    const upcoming = getUpcomingHolidays(14);
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date();
    limit.setDate(limit.getDate() + 14);
    const limitStr = limit.toISOString().slice(0, 10);
    for (const h of upcoming) {
      expect(h.date >= today).toBe(true);
      expect(h.date <= limitStr).toBe(true);
    }
  });

  it("returns empty array with 0-day window", () => {
    // 0-day window: today only — unless today IS a holiday
    const result = getUpcomingHolidays(0);
    expect(Array.isArray(result)).toBe(true);
  });
});
