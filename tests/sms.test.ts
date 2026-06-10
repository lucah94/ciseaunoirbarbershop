/**
 * Tests for src/lib/sms.ts
 *
 * Covers: formatPhone, sendSMS blacklist/dedup guards,
 * sendBarberNotificationSMS filter, sendBookingConfirmationSMS calendar link.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks must be declared before dynamic import of the module under test
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn().mockResolvedValue({}) },
  })),
}));

import { formatPhone } from "@/lib/sms";

// ─── formatPhone ──────────────────────────────────────────────────────────────

describe("formatPhone", () => {
  it("prefixes a 10-digit number with +1", () => {
    expect(formatPhone("4186655703")).toBe("+14186655703");
  });

  it("handles formatted input with spaces and dashes", () => {
    expect(formatPhone("(418) 665-5703")).toBe("+14186655703");
  });

  it("handles 11-digit number starting with 1", () => {
    expect(formatPhone("14186655703")).toBe("+14186655703");
  });

  it("passes through already-international numbers", () => {
    expect(formatPhone("+14186655703")).toBe("+14186655703");
  });

  it("handles short/ambiguous numbers without stripping", () => {
    // Less than 10 digits: just prefixes with +
    expect(formatPhone("555")).toBe("+555");
  });
});

// ─── Shared mock helpers ──────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase";
import twilio from "twilio";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function stubBlacklist(isListed: boolean) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "sms_blacklist") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: isListed ? [{ phone: "4186655703" }] : [] }),
      };
    }
    // sms_log (dedup check + insert)
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn().mockResolvedValue({}),
    };
  });
}

function stubBlacklistAndDedup(isListed: boolean, alreadySent: boolean) {
  let smsLogCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "sms_blacklist") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: isListed ? [{ phone: "4186655703" }] : [] }),
      };
    }
    // sms_log
    smsLogCallCount++;
    if (smsLogCallCount === 1) {
      // wasRecentlySent check
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: alreadySent ? [{ id: "1" }] : [] }),
      };
    }
    // logSMS insert
    return {
      insert: vi.fn().mockResolvedValue({}),
    };
  });
}

// ─── sendSMS: blacklist guard ─────────────────────────────────────────────────

describe("sendSMS — blacklist guard", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TWILIO_ACCOUNT_SID = "ACTEST";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15140000000";
  });

  afterEach(() => vi.clearAllMocks());

  it("skips Twilio send when phone is in sms_blacklist", async () => {
    stubBlacklist(true);
    const { sendSMS } = await import("@/lib/sms");

    await sendSMS("4186655703", "Test message", "test");
    expect(twilio as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("calls Twilio send when phone is NOT in blacklist", async () => {
    stubBlacklistAndDedup(false, false);
    vi.resetModules();
    const { sendSMS } = await import("@/lib/sms");

    await sendSMS("4186655703", "Test message", "test");
    // Twilio create should be called
    const twilioInstance = (twilio as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(twilioInstance?.messages.create).toHaveBeenCalledOnce();
  });

  it("allows send even when the blacklist Supabase query throws (fail-open)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "sms_blacklist") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockRejectedValue(new Error("DB down")),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        insert: vi.fn().mockResolvedValue({}),
      };
    });
    vi.resetModules();
    const { sendSMS } = await import("@/lib/sms");
    // Should not throw — fail-open behavior
    await expect(sendSMS("4186655703", "Test", "test")).resolves.not.toThrow();
  });
});

// ─── sendSMS: 24h dedup guard ─────────────────────────────────────────────────

describe("sendSMS — 24h dedup guard", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TWILIO_ACCOUNT_SID = "ACTEST";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15140000000";
  });

  afterEach(() => vi.clearAllMocks());

  it("skips Twilio send when wasRecentlySent returns true for same type", async () => {
    stubBlacklistAndDedup(false, true);
    vi.resetModules();
    const { sendSMS } = await import("@/lib/sms");

    await sendSMS("4186655703", "Test message", "winback-60d");
    expect(twilio as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("sends and logs when no recent SMS of that type exists", async () => {
    stubBlacklistAndDedup(false, false);
    vi.resetModules();
    const { sendSMS } = await import("@/lib/sms");

    await sendSMS("4186655703", "Test message", "reminder");
    const twilioInstance = (twilio as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(twilioInstance?.messages.create).toHaveBeenCalledOnce();
  });
});

// ─── sendBarberNotificationSMS ────────────────────────────────────────────────

describe("sendBarberNotificationSMS", () => {
  const booking = {
    client_name: "Jean Tremblay",
    client_phone: "4186655703",
    service: "Coupe",
    barber: "Melynda",
    date: "2026-07-01",
    time: "10:00",
  };

  beforeEach(() => {
    vi.resetModules();
    stubBlacklistAndDedup(false, false);
    process.env.TWILIO_ACCOUNT_SID = "ACTEST";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15140000000";
    process.env.MELYNDA_PHONE = "+14181112222";
  });

  afterEach(() => vi.clearAllMocks());

  it("skips send when barber name does not include 'melynda'", async () => {
    const { sendBarberNotificationSMS } = await import("@/lib/sms");
    await sendBarberNotificationSMS({ ...booking, barber: "Stéphanie" });
    // Twilio constructor should never be called if message is skipped
    expect(twilio as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("skips send when MELYNDA_PHONE env var is missing", async () => {
    delete process.env.MELYNDA_PHONE;
    const { sendBarberNotificationSMS } = await import("@/lib/sms");
    await sendBarberNotificationSMS(booking);
    expect(twilio as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("sends to MELYNDA_PHONE when barber name includes 'melynda' (case-insensitive)", async () => {
    const { sendBarberNotificationSMS } = await import("@/lib/sms");
    await sendBarberNotificationSMS({ ...booking, barber: "MELYNDA" });
    const twilioInstance = (twilio as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(twilioInstance?.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+14181112222" })
    );
  });
});

// ─── sendBookingConfirmationSMS ───────────────────────────────────────────────

describe("sendBookingConfirmationSMS", () => {
  const baseBooking = {
    client_name: "Jean Tremblay",
    client_phone: "4186655703",
    service: "Coupe",
    barber: "Melynda",
    date: "2026-07-01",
    time: "10:00",
  };

  beforeEach(() => {
    vi.resetModules();
    stubBlacklistAndDedup(false, false);
    process.env.TWILIO_ACCOUNT_SID = "ACTEST";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15140000000";
    process.env.NEXT_PUBLIC_SITE_URL = "https://ciseaunoirbarbershop.com";
  });

  afterEach(() => vi.clearAllMocks());

  it("includes calendar link in body when booking_id is provided", async () => {
    const { sendBookingConfirmationSMS } = await import("@/lib/sms");
    await sendBookingConfirmationSMS({ ...baseBooking, booking_id: "uuid-booking-123" });
    const twilioInstance = (twilio as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    const [opts] = twilioInstance?.messages.create.mock.calls[0] ?? [];
    expect(opts?.body).toContain("uuid-booking-123");
    expect(opts?.body).toContain("/api/calendar/booking/");
  });

  it("omits calendar link when booking_id is absent", async () => {
    const { sendBookingConfirmationSMS } = await import("@/lib/sms");
    await sendBookingConfirmationSMS(baseBooking);
    const twilioInstance = (twilio as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    const [opts] = twilioInstance?.messages.create.mock.calls[0] ?? [];
    expect(opts?.body).not.toContain("/api/calendar/booking/");
  });

  it("skips Twilio send when phone is blacklisted", async () => {
    stubBlacklist(true);
    vi.resetModules();
    const { sendBookingConfirmationSMS } = await import("@/lib/sms");
    await sendBookingConfirmationSMS(baseBooking);
    expect(twilio as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});

// ─── isBlacklisted: phone normalisation ──────────────────────────────────────

describe("isBlacklisted phone normalisation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TWILIO_ACCOUNT_SID = "ACTEST";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15140000000";
  });

  it("matches +1XXXXXXXXXX against 10-digit stored value — strips +1 before DB query", async () => {
    let capturedEqValue: string | undefined;
    mockFrom.mockImplementation((table: string) => {
      if (table === "sms_blacklist") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((_col, val) => {
            capturedEqValue = val;
            return { limit: vi.fn().mockResolvedValue({ data: [] }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [] }), insert: vi.fn().mockResolvedValue({}) };
    });

    const { sendSMS } = await import("@/lib/sms");
    await sendSMS("+14186655703", "test", "test");
    // The DB query should use the 10-digit normalised form (last 10 digits)
    expect(capturedEqValue).toBe("4186655703");
  });

  it("matches formatted number (spaces/dashes) against plain 10-digit stored value", async () => {
    let capturedEqValue: string | undefined;
    mockFrom.mockImplementation((table: string) => {
      if (table === "sms_blacklist") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((_col, val) => {
            capturedEqValue = val;
            return { limit: vi.fn().mockResolvedValue({ data: [] }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [] }), insert: vi.fn().mockResolvedValue({}) };
    });

    vi.resetModules();
    const { sendSMS } = await import("@/lib/sms");
    await sendSMS("(418) 665-5703", "test", "test");
    expect(capturedEqValue).toBe("4186655703");
  });
});
