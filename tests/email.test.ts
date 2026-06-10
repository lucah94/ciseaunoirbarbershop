/**
 * Tests for src/lib/email.ts
 *
 * Strategy: mock Resend and the telegram module so tests are pure unit tests.
 * Focus on the business logic that varies (reengagement variants, subject lines,
 * URL construction) rather than HTML layout.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Resend ──────────────────────────────────────────────────────────────
// vi.mock is hoisted above imports, so we cannot reference a const defined below.
// Use vi.hoisted() to share the spy across the hoisted factory and the test body.

const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "test-id" }));

vi.mock("resend", () => ({
  Resend: function Resend() {
    return { emails: { send: mockSend } };
  },
}));

// Mock telegram to prevent side-effect network calls
vi.mock("@/lib/telegram", () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
  notifyNoShow: vi.fn().mockResolvedValue(undefined),
  sendWeeklyReport: vi.fn().mockResolvedValue(undefined),
}));

import {
  sendBookingConfirmation,
  sendBookingNotificationAdmin,
  sendReengagementEmail,
  sendReferralEmail,
  sendFirstVisitPromoEmail,
  sendWeeklyReportEmail,
  sendConfirmationReminderEmail,
  sendReminderEmail,
  sendReviewRequestEmail,
  sendRebookingEmail,
  sendNoShowAdminNotification,
  sendContactNotification,
} from "@/lib/email";

function getSentEmail() {
  return mockSend.mock.calls[mockSend.mock.calls.length - 1][0] as {
    to: string;
    subject: string;
    html: string;
    from: string;
    replyTo?: string;
  };
}

beforeEach(() => {
  mockSend.mockClear();
});

// ─── sendBookingConfirmation ──────────────────────────────────────────────────

describe("sendBookingConfirmation", () => {
  const baseBooking = {
    client_name: "Jean Tremblay",
    client_email: "jean@example.com",
    service: "Coupe classique",
    barber: "Melynda",
    date: "2026-06-15",
    time: "10:00",
    price: 35,
  };

  it("sends email to client", async () => {
    await sendBookingConfirmation(baseBooking);
    expect(getSentEmail().to).toBe("jean@example.com");
  });

  it("subject includes service name", async () => {
    await sendBookingConfirmation(baseBooking);
    expect(getSentEmail().subject).toContain("Coupe classique");
  });

  it("HTML escapes client name to prevent XSS", async () => {
    await sendBookingConfirmation({ ...baseBooking, client_name: '<script>alert("xss")</script>' });
    expect(getSentEmail().html).not.toContain("<script>");
  });

  it("includes cancel link when booking_id is provided", async () => {
    await sendBookingConfirmation({ ...baseBooking, booking_id: "abc-123" });
    expect(getSentEmail().html).toContain("abc-123");
  });

  it("does not include cancel link when booking_id is absent", async () => {
    await sendBookingConfirmation(baseBooking);
    expect(getSentEmail().html).not.toContain("cancel");
  });

  it("includes note in email when provided", async () => {
    await sendBookingConfirmation({ ...baseBooking, note: "Allergie latex" });
    expect(getSentEmail().html).toContain("Allergie latex");
  });

  it("does not include note section when note is absent", async () => {
    await sendBookingConfirmation(baseBooking);
    expect(getSentEmail().html).not.toContain("Note :");
  });
});

// ─── sendReengagementEmail — variant dispatch ─────────────────────────────────

describe("sendReengagementEmail — variant selection", () => {
  const base = {
    client_name: "Marie",
    client_email: "marie@example.com",
    barber: "Stéphanie",
  };

  it("variant 30: subject mentions 1 mois", async () => {
    await sendReengagementEmail({ ...base, variant: 30 });
    expect(getSentEmail().subject).toContain("mois");
  });

  it("variant 60: subject mentions 2 mois", async () => {
    await sendReengagementEmail({ ...base, variant: 60 });
    expect(getSentEmail().subject).toContain("2 mois");
  });

  it("variant 90: subject mentions 3 mois", async () => {
    await sendReengagementEmail({ ...base, variant: 90 });
    expect(getSentEmail().subject).toContain("3 mois");
  });

  it("variant 30 and 60 produce different subjects", async () => {
    await sendReengagementEmail({ ...base, variant: 30 });
    const sub30 = getSentEmail().subject;
    mockSend.mockClear();
    await sendReengagementEmail({ ...base, variant: 60 });
    const sub60 = getSentEmail().subject;
    expect(sub30).not.toBe(sub60);
  });

  it("all variants include the barber name in HTML body", async () => {
    for (const variant of [30, 60, 90] as const) {
      mockSend.mockClear();
      await sendReengagementEmail({ ...base, variant });
      expect(getSentEmail().html).toContain("Stéphanie");
    }
  });

  it("all variants send to client email", async () => {
    for (const variant of [30, 60, 90] as const) {
      mockSend.mockClear();
      await sendReengagementEmail({ ...base, variant });
      expect(getSentEmail().to).toBe("marie@example.com");
    }
  });
});

// ─── sendReferralEmail ────────────────────────────────────────────────────────

describe("sendReferralEmail", () => {
  it("sends to referred email", async () => {
    await sendReferralEmail({
      referrer_name: "Paul",
      referred_name: "Sophie",
      referred_email: "sophie@test.com",
      code: "PAUL5",
    });
    expect(getSentEmail().to).toBe("sophie@test.com");
  });

  it("includes referral code in email body", async () => {
    await sendReferralEmail({
      referrer_name: "Paul",
      referred_name: "Sophie",
      referred_email: "sophie@test.com",
      code: "PAUL5",
    });
    expect(getSentEmail().html).toContain("PAUL5");
  });

  it("includes referrer name in subject", async () => {
    await sendReferralEmail({
      referrer_name: "Alice",
      referred_name: "Bob",
      referred_email: "bob@test.com",
      code: "ALICE5",
    });
    expect(getSentEmail().subject).toContain("Alice");
  });
});

// ─── sendFirstVisitPromoEmail ─────────────────────────────────────────────────

describe("sendFirstVisitPromoEmail", () => {
  it("includes promo code in HTML", async () => {
    await sendFirstVisitPromoEmail({
      client_name: "Luc",
      client_email: "luc@test.com",
      barber: "Melynda",
      promo_code: "WELCOME10",
    });
    expect(getSentEmail().html).toContain("WELCOME10");
  });

  it("subject mentions 10% rabais", async () => {
    await sendFirstVisitPromoEmail({
      client_name: "Luc",
      client_email: "luc@test.com",
      barber: "Melynda",
      promo_code: "WELCOME10",
    });
    expect(getSentEmail().subject).toContain("10%");
  });
});

// ─── sendContactNotification ──────────────────────────────────────────────────

describe("sendContactNotification", () => {
  it("sets replyTo to the sender email", async () => {
    await sendContactNotification({
      name: "Test User",
      email: "test@example.com",
      message: "Bonjour",
    });
    expect(getSentEmail().replyTo).toBe("test@example.com");
  });

  it("escapes HTML in message to prevent XSS", async () => {
    await sendContactNotification({
      name: "Test",
      email: "t@t.com",
      message: '<script>alert("xss")</script>',
    });
    expect(getSentEmail().html).not.toContain("<script>");
  });

  it("includes sender name in subject", async () => {
    await sendContactNotification({
      name: "Jean Valjean",
      email: "jv@test.com",
      message: "Question",
    });
    expect(getSentEmail().subject).toContain("Jean Valjean");
  });
});

// ─── sendWeeklyReportEmail ────────────────────────────────────────────────────

describe("sendWeeklyReportEmail", () => {
  it("includes revenue formatted with 2 decimal places", async () => {
    await sendWeeklyReportEmail({
      startDate: "2026-06-02",
      endDate: "2026-06-08",
      totalBookings: 20,
      totalRevenue: 750,
      cancellations: 2,
      noShows: 1,
      newWaitlist: 3,
      bookingsMelynda: 20,
    });
    expect(getSentEmail().html).toContain("750.00$");
  });

  it("uses plural for newWaitlist > 1", async () => {
    await sendWeeklyReportEmail({
      startDate: "2026-06-02",
      endDate: "2026-06-08",
      totalBookings: 10,
      totalRevenue: 400,
      cancellations: 1,
      noShows: 0,
      newWaitlist: 3,
      bookingsMelynda: 10,
    });
    expect(getSentEmail().html).toContain("inscriptions");
  });

  it("uses singular for newWaitlist === 1", async () => {
    await sendWeeklyReportEmail({
      startDate: "2026-06-02",
      endDate: "2026-06-08",
      totalBookings: 10,
      totalRevenue: 400,
      cancellations: 1,
      noShows: 0,
      newWaitlist: 1,
      bookingsMelynda: 10,
    });
    // Should not contain "inscriptions" (plural)
    expect(getSentEmail().html).not.toContain("inscriptions");
    expect(getSentEmail().html).toContain("inscription");
  });
});

// ─── Edge: XSS escaping ───────────────────────────────────────────────────────

describe("XSS protection across email functions", () => {
  it("sendBookingNotificationAdmin escapes client name (no live HTML tags)", async () => {
    await sendBookingNotificationAdmin({
      client_name: '<img src=x onerror="alert(1)">',
      client_phone: "+1",
      client_email: "a@b.com",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-07-01",
      time: "10:00",
      price: 35,
    });
    const html = getSentEmail().html;
    // The literal < char must not appear in the attribute value — only &lt;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("sendNoShowAdminNotification escapes client name", async () => {
    await sendNoShowAdminNotification({
      client_name: "<b>Injected</b>",
      client_phone: "+1",
      client_email: "a@b.com",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-07-01",
      time: "10:00",
    });
    const html = getSentEmail().html;
    expect(html).not.toContain("<b>Injected</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});
