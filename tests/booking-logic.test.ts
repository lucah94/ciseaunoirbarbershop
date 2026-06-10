/**
 * Unit tests for the service duration and overlap detection logic
 * extracted from /api/bookings route.
 *
 * The svcDuration function is inlined in the route — we replicate
 * it here to test the business rules independently.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the booking validation schema (mirrors route.ts)
const bookingSchema = z.object({
  client_name: z.string().min(1).max(100),
  client_email: z.string().email().optional().or(z.literal("")),
  client_phone: z.string().optional().or(z.literal("")),
  service: z.string().min(1),
  barber: z.enum(["Melynda", "Stéphanie"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
  price: z.number().optional(),
  note: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional().default("confirmed"),
  source: z.enum(["direct", "google", "facebook", "instagram", "referral", "messenger"]).optional().default("direct"),
});

// Mirror the svcDuration logic from route.ts
function svcDuration(service: string): number {
  const s = service.toLowerCase();
  if (s.includes("premium") || s.includes("forfait")) return 75;
  if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
  if (s.includes("coupe") || s.includes("lavage") || s.includes("étudiant") || s.includes("etudiant") || s.includes("enfant")) return 45;
  return 30;
}

// Overlap check logic from route.ts
function hasOverlap(newTime: string, newService: string, existing: { time: string; service: string; end_time?: string | null }[]): boolean {
  const [nh, nm] = newTime.split(":").map(Number);
  const newStart = nh * 60 + nm;
  const newEnd = newStart + svcDuration(newService);

  for (const b of existing) {
    const [bh, bm] = (b.time || "0:0").split(":").map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = b.end_time
      ? (() => { const [eh, em] = b.end_time!.split(":").map(Number); return eh * 60 + em; })()
      : bStart + svcDuration(b.service);
    if (newStart < bEnd && newEnd > bStart) return true;
  }
  return false;
}

describe("svcDuration", () => {
  it("returns 75 for premium service", () => {
    expect(svcDuration("Service Premium")).toBe(75);
    expect(svcDuration("Forfait complet")).toBe(75);
  });

  it("returns 60 for coupe + barbe combos", () => {
    expect(svcDuration("Coupe + Barbe")).toBe(60);
    expect(svcDuration("Coupe + Rasage lame")).toBe(60);
  });

  it("returns 45 for coupe alone", () => {
    expect(svcDuration("Coupe classique")).toBe(45);
    expect(svcDuration("Coupe enfant")).toBe(45);
    expect(svcDuration("Coupe étudiant")).toBe(45);
    expect(svcDuration("Coupe + Lavage")).toBe(45);
  });

  it("returns 30 for barbe/rasage alone (no coupe)", () => {
    expect(svcDuration("Taille de barbe")).toBe(30);
    expect(svcDuration("Rasage")).toBe(30);
  });

  it("returns 30 for unknown services", () => {
    expect(svcDuration("Unknown service")).toBe(30);
    expect(svcDuration("")).toBe(30);
  });

  it("is case-insensitive", () => {
    expect(svcDuration("COUPE CLASSIQUE")).toBe(45);
    expect(svcDuration("Premium Package")).toBe(75);
  });
});

describe("overlap detection", () => {
  it("detects direct overlap", () => {
    const existing = [{ time: "10:00", service: "Coupe classique" }]; // 10:00–10:45
    expect(hasOverlap("10:15", "Coupe classique", existing)).toBe(true);
  });

  it("detects overlap at exact same time", () => {
    const existing = [{ time: "14:00", service: "Coupe classique" }];
    expect(hasOverlap("14:00", "Coupe classique", existing)).toBe(true);
  });

  it("does not flag adjacent appointments (back-to-back)", () => {
    const existing = [{ time: "10:00", service: "Coupe classique" }]; // ends 10:45
    expect(hasOverlap("10:45", "Coupe classique", existing)).toBe(false);
  });

  it("does not flag non-overlapping appointments", () => {
    const existing = [{ time: "10:00", service: "Coupe classique" }]; // ends 10:45
    expect(hasOverlap("11:00", "Coupe classique", existing)).toBe(false);
  });

  it("uses end_time from DB when present", () => {
    // Booking stored with explicit end_time 11:00
    const existing = [{ time: "10:00", service: "Coupe classique", end_time: "11:00" }];
    // New appointment at 10:50 — within end_time 11:00
    expect(hasOverlap("10:50", "Coupe classique", existing)).toBe(true);
    // New appointment at exactly 11:00 — not overlapping
    expect(hasOverlap("11:00", "Coupe classique", existing)).toBe(false);
  });

  it("handles multiple existing bookings", () => {
    const existing = [
      { time: "09:00", service: "Coupe classique" }, // 09:00–09:45
      { time: "11:00", service: "Coupe classique" }, // 11:00–11:45
    ];
    expect(hasOverlap("09:30", "Coupe classique", existing)).toBe(true);  // overlaps first
    expect(hasOverlap("11:30", "Coupe classique", existing)).toBe(true);  // overlaps second
    // 09:45 + 30min taille de barbe = 09:45–10:15 — no overlap with either slot
    expect(hasOverlap("09:45", "Taille de barbe", existing)).toBe(false);
  });

  it("overlap with premium service (75 min)", () => {
    const existing = [{ time: "10:00", service: "Service Premium" }]; // 10:00–11:15
    expect(hasOverlap("11:00", "Coupe classique", existing)).toBe(true);  // within 11:15
    expect(hasOverlap("11:15", "Coupe classique", existing)).toBe(false); // exactly after
  });
});

describe("bookingSchema validation", () => {
  const validBooking = {
    client_name: "Jean Tremblay",
    client_email: "jean@example.com",
    client_phone: "4186655703",
    service: "Coupe classique",
    barber: "Melynda" as const,
    date: "2026-06-15",
    time: "10:00",
    price: 35,
  };

  it("accepts a valid booking", () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it("rejects missing client_name", () => {
    const { client_name: _, ...rest } = validBooking;
    const r = bookingSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const r = bookingSchema.safeParse({ ...validBooking, client_email: "notanemail" });
    expect(r.success).toBe(false);
  });

  it("accepts empty string for email (optional)", () => {
    const r = bookingSchema.safeParse({ ...validBooking, client_email: "" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const r = bookingSchema.safeParse({ ...validBooking, date: "15/06/2026" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const r = bookingSchema.safeParse({ ...validBooking, time: "25:00" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown barber", () => {
    const r = bookingSchema.safeParse({ ...validBooking, barber: "John" });
    expect(r.success).toBe(false);
  });

  it("accepts Stéphanie as a barber", () => {
    const r = bookingSchema.safeParse({ ...validBooking, barber: "Stéphanie" });
    expect(r.success).toBe(true);
  });

  it("rejects note longer than 500 chars", () => {
    const r = bookingSchema.safeParse({ ...validBooking, note: "x".repeat(501) });
    expect(r.success).toBe(false);
  });

  it("defaults status to 'confirmed' when omitted", () => {
    const r = bookingSchema.safeParse(validBooking);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("confirmed");
  });

  it("defaults source to 'direct' when omitted", () => {
    const r = bookingSchema.safeParse(validBooking);
    if (r.success) expect(r.data.source).toBe("direct");
  });

  it("rejects invalid source value", () => {
    const r = bookingSchema.safeParse({ ...validBooking, source: "tiktok" });
    expect(r.success).toBe(false);
  });
});
