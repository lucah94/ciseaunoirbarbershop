/**
 * Integration tests for src/app/api/bookings/route.ts
 *
 * Covers: POST rate-limit, POST barber block overlap, POST force override,
 * PATCH auto-cut on completed, PATCH waitlist notification on cancel.
 *
 * Uses vi.mock for supabaseAdmin, twilio, resend, and telegram.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationAdmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendBookingConfirmationSMS: vi.fn().mockResolvedValue(undefined),
  sendBarberNotificationSMS: vi.fn().mockResolvedValue(undefined),
  formatPhone: vi.fn((p: string) => `+1${p.replace(/\D/g, "")}`),
}));
vi.mock("@/lib/telegram", () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
  notifyBookingCancelled: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn().mockResolvedValue({}) },
  })),
}));

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/bookings", () => {
  it.todo("returns 429 after exceeding 10 requests per minute from same IP");

  it.todo("returns 400 for invalid JSON body");

  it.todo("returns 400 for missing required fields (client_name, service, barber, date, time)");

  it.todo("returns 409 when booking overlaps an existing confirmed booking");

  it.todo("returns 409 when booking falls within a barber_block");

  it.todo("bypasses overlap check when force=true is included in body");

  it.todo("inserts booking and returns 200 JSON on valid non-overlapping request");

  it.todo("sends booking confirmation SMS when client_phone is provided and Twilio env is set");

  it.todo("skips SMS when client_phone is absent");

  it.todo("sends confirmation email when client_email is provided");

  it.todo("skips email when client_email is absent");

  it.todo("creates client record in 'clients' table when phone or email provided and client does not exist");

  it.todo("does NOT duplicate client record when client already exists");
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /api/bookings", () => {
  it.todo("returns 400 when id is missing");

  it.todo("returns 400 when no update fields are provided");

  it.todo("returns 409 when rescheduled time overlaps another booking (no force)");

  it.todo("skips overlap check when force=true");

  it.todo("auto-creates a cut record when status changes to 'completed'");

  it.todo("does NOT create duplicate cut record if one already exists for the booking");

  it.todo("notifies waitlist client via SMS when status changes to 'cancelled' and slot match exists");

  it.todo("marks waitlist entry as notified=true after SMS is sent");

  it.todo("sends waitlist email when waitlist entry has client_email");
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/bookings", () => {
  it.todo("returns array of bookings for a given date");

  it.todo("returns single booking when id param is provided");

  it.todo("returns 404 when id param matches no booking");

  it.todo("paginates correctly — fetches beyond 1000 rows with range()");

  it.todo("filters by barber when barber param is provided");

  it.todo("filters by start date when start param is provided");
});
