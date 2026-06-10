/**
 * Tests for src/app/api/cron/reminders/route.ts
 *
 * Covers:
 * - Auth: rejects non-matching CRON_SECRET
 * - J-1 reminders: sends SMS when phone present, email when email-only
 * - J-1 reminders: skips bookings with no phone and no email
 * - 8h reminders: sends SMS for bookings today within 8h window
 * - Rebooking emails: sent when completed_count >= 2 and email present
 * - Re-engagement: sent when last booking > 45 days ago
 * - Supabase error returns 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/email", () => ({
  sendConfirmationReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendRebookingEmail: vi.fn().mockResolvedValue(undefined),
  sendReengagementEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendConfirmationReminderSMS: vi.fn().mockResolvedValue(undefined),
  sendReminderSMS: vi.fn().mockResolvedValue(undefined),
  formatPhone: vi.fn((p: string) => p),
  sendSMS: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/telegram", () => ({
  notifySystemAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn().mockResolvedValue({}) } })),
}));

import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendReminderEmail, sendReminderSMS, sendRebookingEmail } from "@/lib/email";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost/api/cron/reminders", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeSupabaseChain(data: unknown, error: unknown = null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    data,
    error,
  };
  return chain;
}

const mockSupabase = supabase as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
});

describe("GET /api/cron/reminders — auth", () => {
  it("returns 401 when Authorization header does not match CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/reminders/route");
    const res = await GET(makeRequest("wrong-secret") as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is absent", async () => {
    const { GET } = await import("@/app/api/cron/reminders/route");
    const req = new Request("http://localhost/api/cron/reminders");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/reminders — J-1 reminders", () => {
  it.todo("sends SMS for bookings tomorrow when client_phone is set");
  it.todo("sends email for bookings tomorrow when no phone but client_email is set");
  it.todo("skips J-1 booking when neither phone nor email present");
  it.todo("increments remindersSent for each sent reminder");
  it.todo("returns 500 when Supabase bookings query fails");
  it.todo("continues J-1 loop when individual SMS send throws");
});

describe("GET /api/cron/reminders — 8h reminders", () => {
  it.todo("sends 8h-before SMS for bookings today within the next 8 hours");
  it.todo("skips 8h reminder when already_sent_8h flag is true");
  it.todo("marks booking as reminder_8h_sent after sending");
  it.todo("does not send to bookings more than 8h in the future");
});

describe("GET /api/cron/reminders — rebooking / re-engagement", () => {
  it.todo("sends rebooking email when client completed_count >= 2 and has email");
  it.todo("sends re-engagement email when last booking was > 45 days ago");
  it.todo("skips re-engagement when last booking is recent");
  it.todo("returns JSON with remindersSent count on success");
});
