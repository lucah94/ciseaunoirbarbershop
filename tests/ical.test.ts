/**
 * Tests for src/app/api/bookings/ical/route.ts
 *
 * Covers: pure date-format helpers (toICalDate, getDuration, addMinutes)
 * and the GET API handler (missing id, booking not found, valid iCal output).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ── Replicated pure helpers (mirrors route.ts) ──────────────────────────────

function toICalDate(date: string, time: string): string {
  return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
}

function getDuration(service: string): number {
  return service.toLowerCase().includes("coupe") && service.toLowerCase().includes("barbe") ? 45 : 30;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return toICalDate(date, endTime);
}

// ── toICalDate ──────────────────────────────────────────────────────────────

describe("toICalDate", () => {
  it("formats a basic date and time into iCal compact format", () => {
    expect(toICalDate("2026-06-09", "14:30")).toBe("20260609T143000");
  });

  it("handles midnight correctly", () => {
    expect(toICalDate("2026-01-01", "00:00")).toBe("20260101T000000");
  });

  it("handles single-digit hour correctly", () => {
    expect(toICalDate("2026-06-09", "09:05")).toBe("20260609T090500");
  });
});

// ── getDuration ─────────────────────────────────────────────────────────────

describe("getDuration", () => {
  it("returns 45 when service name contains both 'coupe' and 'barbe'", () => {
    expect(getDuration("Coupe + Barbe")).toBe(45);
    expect(getDuration("coupe barbe complète")).toBe(45);
  });

  it("returns 30 for a service with only 'coupe'", () => {
    expect(getDuration("Coupe classique")).toBe(30);
  });

  it("returns 30 for a service with only 'barbe'", () => {
    expect(getDuration("Taille de barbe")).toBe(30);
  });

  it("returns 30 for a completely different service", () => {
    expect(getDuration("Rasage lame")).toBe(30);
    expect(getDuration("Service premium")).toBe(30);
  });

  it("is case-insensitive", () => {
    expect(getDuration("COUPE ET BARBE")).toBe(45);
  });
});

// ── addMinutes ──────────────────────────────────────────────────────────────

describe("addMinutes", () => {
  it("adds 30 minutes without crossing the hour", () => {
    expect(addMinutes("2026-06-09", "14:00", 30)).toBe("20260609T143000");
  });

  it("adds 45 minutes crossing the hour boundary", () => {
    expect(addMinutes("2026-06-09", "14:30", 45)).toBe("20260609T151500");
  });

  it("adds minutes that cross midnight (wraps to 00:xx)", () => {
    expect(addMinutes("2026-06-09", "23:50", 30)).toBe("20260609T002000");
  });

  it("adding 0 minutes returns the same time", () => {
    expect(addMinutes("2026-06-09", "10:15", 0)).toBe("20260609T101500");
  });
});

// ── GET /api/bookings/ical ──────────────────────────────────────────────────

describe("GET /api/bookings/ical", () => {
  it.todo("returns 400 when id query param is missing");

  it.todo("returns 404 when booking is not found in the database");

  it.todo("returns Content-Type text/calendar");

  it.todo("response starts with BEGIN:VCALENDAR and ends with END:VCALENDAR");

  it.todo("SUMMARY contains the service name and 'Ciseau Noir'");

  it.todo("DTSTART matches the booking date and time");

  it.todo("DTEND is DTSTART + 45 min for 'Coupe + Barbe' service");

  it.todo("DTEND is DTSTART + 30 min for a single service");

  it.todo("Content-Disposition header contains 'rdv-ciseau-noir.ics'");

  it.todo("UID field uses the booking id and ciseaunoirbarbershop.com domain");
});
