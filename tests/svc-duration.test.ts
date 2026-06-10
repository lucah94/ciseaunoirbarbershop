/**
 * Tests for the svcDuration business rule.
 *
 * The function lives inline in src/app/api/bookings/route.ts and is duplicated
 * in other routes. These tests document the expected contract so it can be
 * safely extracted into a shared lib/booking-utils.ts.
 *
 * Until extraction: replicate the logic here (mirrors route.ts exactly).
 */
import { describe, it, expect } from "vitest";

function svcDuration(service: string): number {
  const s = service.toLowerCase();
  if (s.includes("premium") || s.includes("forfait")) return 75;
  if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
  if (s.includes("coupe") || s.includes("lavage") || s.includes("étudiant") || s.includes("etudiant") || s.includes("enfant")) return 45;
  return 30;
}

describe("svcDuration", () => {
  // ── 75-minute tier ──────────────────────────────────────────────────────────

  it("returns 75 for a service containing 'premium'", () => {
    expect(svcDuration("Coupe premium")).toBe(75);
  });

  it("returns 75 for a service containing 'forfait'", () => {
    expect(svcDuration("Forfait barbe + coupe")).toBe(75);
  });

  it("is case-insensitive for 'Premium'", () => {
    expect(svcDuration("PREMIUM")).toBe(75);
  });

  // ── 60-minute tier ──────────────────────────────────────────────────────────

  it("returns 60 when service contains both 'barbe' and 'coupe'", () => {
    expect(svcDuration("Coupe + barbe")).toBe(60);
  });

  it("returns 60 when service contains both 'rasage' and 'coupe'", () => {
    expect(svcDuration("Coupe + rasage à la lame")).toBe(60);
  });

  it("returns 60 when service contains both 'lame' and 'coupe'", () => {
    expect(svcDuration("Coupe lame")).toBe(60);
  });

  it("does NOT return 60 for 'barbe' alone (no 'coupe')", () => {
    // barbe without coupe → falls through to default 30
    expect(svcDuration("Barbe seulement")).toBe(30);
  });

  // ── 45-minute tier ──────────────────────────────────────────────────────────

  it("returns 45 for a plain 'coupe'", () => {
    expect(svcDuration("Coupe classique")).toBe(45);
  });

  it("returns 45 for 'lavage'", () => {
    expect(svcDuration("Lavage + séchage")).toBe(45);
  });

  it("returns 45 for 'étudiant' (accented)", () => {
    expect(svcDuration("Tarif étudiant")).toBe(45);
  });

  it("returns 45 for 'etudiant' (unaccented)", () => {
    expect(svcDuration("Tarif etudiant")).toBe(45);
  });

  it("returns 45 for 'enfant'", () => {
    expect(svcDuration("Coupe enfant")).toBe(45);
  });

  // ── 30-minute default ───────────────────────────────────────────────────────

  it("returns 30 for an unknown / beard-only service", () => {
    expect(svcDuration("Dessin barbe")).toBe(30);
  });

  it("returns 30 for an empty string", () => {
    expect(svcDuration("")).toBe(30);
  });

  it("returns 30 for a service with no matching keyword", () => {
    expect(svcDuration("Traitement cuir chevelu")).toBe(30);
  });

  // ── Priority: 75 wins over 45 ───────────────────────────────────────────────

  it("premium takes priority over coupe (returns 75, not 45)", () => {
    expect(svcDuration("Coupe premium")).toBe(75);
  });

  // ── Overlap detection contract ──────────────────────────────────────────────

  it("two 45-min bookings at 10:00 and 10:30 overlap (10:00-10:45 vs 10:30-11:15)", () => {
    const aStart = 10 * 60 + 0;
    const aEnd = aStart + svcDuration("Coupe classique"); // 10:45
    const bStart = 10 * 60 + 30;
    const bEnd = bStart + svcDuration("Coupe classique"); // 11:15
    expect(aStart < bEnd && aEnd > bStart).toBe(true);
  });

  it("two 45-min bookings at 10:00 and 10:45 do NOT overlap", () => {
    const aStart = 10 * 60 + 0;
    const aEnd = aStart + svcDuration("Coupe classique"); // 10:45
    const bStart = 10 * 60 + 45;
    const bEnd = bStart + svcDuration("Coupe classique");
    expect(aStart < bEnd && aEnd > bStart).toBe(false);
  });
});
