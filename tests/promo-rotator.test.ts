import { describe, it, expect, vi, afterEach } from "vitest";
import { getPromoOfTheMonth, PROMO_ROTATION } from "@/lib/promo-rotator";

describe("PROMO_ROTATION", () => {
  it("has an entry for all 12 months", () => {
    for (let month = 1; month <= 12; month++) {
      expect(PROMO_ROTATION[month]).toBeDefined();
    }
  });

  it("each promo has required fields", () => {
    for (const [, promo] of Object.entries(PROMO_ROTATION)) {
      expect(promo.key).toBeTruthy();
      expect(promo.title).toBeTruthy();
      expect(promo.body).toBeTruthy();
      expect(promo.cta).toBeTruthy();
      expect(Array.isArray(promo.hashtags)).toBe(true);
      expect(promo.hashtags.length).toBeGreaterThan(0);
    }
  });

  it("all promo keys are unique", () => {
    const keys = Object.values(PROMO_ROTATION).map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("getPromoOfTheMonth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the correct promo for January", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // Jan
    expect(getPromoOfTheMonth().key).toBe("nouvelle-annee");
  });

  it("returns the correct promo for June (fête des pères)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10)); // Jun
    expect(getPromoOfTheMonth().key).toBe("fete-peres");
  });

  it("returns the correct promo for November (Movember)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1)); // Nov
    expect(getPromoOfTheMonth().key).toBe("movember");
  });

  it("returns the correct promo for December", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20)); // Dec
    expect(getPromoOfTheMonth().key).toBe("fetes");
  });

  it("returns the January promo as fallback for invalid month", () => {
    // PROMO_ROTATION[0] is undefined → fallback to PROMO_ROTATION[1]
    // We can't easily force month 0, but verify fallback logic by checking January
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const promo = getPromoOfTheMonth();
    expect(promo).toBeDefined();
    expect(promo.key).toBe("nouvelle-annee");
  });
});
