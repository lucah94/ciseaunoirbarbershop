/**
 * Tests for src/lib/telegram.ts
 *
 * Strategy: mock global `fetch` to intercept Telegram API calls.
 * Pure helper `formatDate` is tested directly by temporarily exposing it
 * through the notification functions' observable output.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock fetch before importing the module ───────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing so the module captures our mock
import {
  notifyNewBooking,
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyNoShow,
  notifyNoShowDigest,
  notifyEscalation,
  notifyMessengerUnreachable,
  proposeRescheduleNotification,
  sendDailyReport,
  sendWeeklyReport,
  notifySystemAlert,
  notifyLowTwilioBalance,
  notifyWaitlistEntry,
  notifyNewContactMessage,
  sendEmailApprovalRequest,
} from "@/lib/telegram";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setEnv(token = "test-token", chatId = "123456") {
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_GROUP_CHAT_ID = chatId;
}

function clearEnv() {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_GROUP_CHAT_ID;
}

function mockFetchOk() {
  mockFetch.mockResolvedValue({ ok: true });
}

function capturedText(): string {
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  return body.text;
}

// ─── isConfigured (via return value) ─────────────────────────────────────────

describe("when Telegram is NOT configured", () => {
  beforeEach(() => {
    clearEnv();
    mockFetch.mockClear();
  });

  it("notifyNewBooking returns without calling fetch", async () => {
    await notifyNewBooking({
      client_name: "Jean",
      client_phone: "+14185551234",
      service: "Coupe classique",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
      price: 35,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendEmailApprovalRequest returns false", async () => {
    const result = await sendEmailApprovalRequest({
      id: "abc",
      from_name: "Client",
      from_email: "c@example.com",
      subject: "Question",
      original_body: "Hello",
      draft_response: "Hi!",
    });
    expect(result).toBe(false);
  });
});

// ─── notifyNewBooking ─────────────────────────────────────────────────────────

describe("notifyNewBooking", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("calls Telegram API with correct URL", async () => {
    await notifyNewBooking({
      client_name: "Jean Tremblay",
      client_phone: "+14185551234",
      service: "Coupe classique",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
      price: 35,
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain("/sendMessage");
  });

  it("includes client name and service in message body", async () => {
    await notifyNewBooking({
      client_name: "Marie Dupont",
      client_phone: "+14189876543",
      service: "Coupe + Barbe",
      barber: "Stéphanie",
      date: "2026-06-20",
      time: "14:30",
      price: 50,
    });
    const text = capturedText();
    expect(text).toContain("Marie Dupont");
    expect(text).toContain("Coupe + Barbe");
    expect(text).toContain("50$");
  });

  it("shows google source icon when source is google", async () => {
    await notifyNewBooking({
      client_name: "Test",
      client_phone: "+1",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-07-01",
      time: "09:00",
      price: 35,
      source: "google",
    });
    expect(capturedText()).toContain("🔍");
  });

  it("shows facebook icon when source is facebook", async () => {
    await notifyNewBooking({
      client_name: "Test",
      client_phone: "+1",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-07-01",
      time: "09:00",
      price: 35,
      source: "facebook",
    });
    expect(capturedText()).toContain("📘");
  });

  it("returns true when fetch succeeds", async () => {
    // notifyNewBooking is void, but fetch must be called once
    await notifyNewBooking({
      client_name: "T",
      client_phone: "+1",
      service: "S",
      barber: "Melynda",
      date: "2026-07-01",
      time: "09:00",
      price: 30,
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

// ─── formatDate (observable through message text) ─────────────────────────────

describe("formatDate (via notification output)", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("formats 2026-06-15 in French short form", async () => {
    await notifyBookingCancelled({
      client_name: "Test",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
    });
    const text = capturedText();
    // Should include month name in French (juin) and day number
    expect(text).toMatch(/juin|lun|mar|mer|jeu|ven|sam|dim/);
  });

  it("does not produce 'undefined' or 'NaN' for a valid date string", async () => {
    await notifySystemAlert("OK");
    // systemAlert doesn't use formatDate, but verify notifyBookingCancelled doesn't
    mockFetch.mockClear();
    await notifyBookingCancelled({
      client_name: "Test",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-01-01",
      time: "09:00",
    });
    expect(capturedText()).not.toContain("NaN");
    expect(capturedText()).not.toContain("undefined");
  });
});

// ─── sendDailyReport ──────────────────────────────────────────────────────────

describe("sendDailyReport", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("includes revenue and booking counts", async () => {
    await sendDailyReport({
      date: "2026-06-09",
      bookings_today: 8,
      revenue_today: 320,
      bookings_tomorrow: 5,
      revenue_week: 1200,
    });
    const text = capturedText();
    expect(text).toContain("8 RDV");
    expect(text).toContain("320$");
  });

  it("includes Twilio warning when low_twilio_balance is true", async () => {
    await sendDailyReport({
      date: "2026-06-09",
      bookings_today: 3,
      revenue_today: 105,
      bookings_tomorrow: 2,
      revenue_week: 500,
      low_twilio_balance: true,
      twilio_balance: 3.45,
    });
    const text = capturedText();
    expect(text).toContain("Twilio");
    expect(text).toContain("3.45");
  });

  it("omits balance warning when low_twilio_balance is false", async () => {
    await sendDailyReport({
      date: "2026-06-09",
      bookings_today: 3,
      revenue_today: 105,
      bookings_tomorrow: 2,
      revenue_week: 500,
      low_twilio_balance: false,
    });
    expect(capturedText()).not.toContain("Twilio bas");
  });
});

// ─── notifyEscalation ────────────────────────────────────────────────────────

describe("notifyEscalation", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("truncates message longer than 200 chars", async () => {
    const longMessage = "x".repeat(300);
    await notifyEscalation({
      from_name: "Client",
      from_email: "c@example.com",
      message: longMessage,
    });
    const text = capturedText();
    expect(text).toContain("...");
    // The preview should be at most ~200 chars of the message content
    expect(text.includes("x".repeat(201))).toBe(false);
  });

  it("shows AI response note when ai_response is provided", async () => {
    await notifyEscalation({
      from_name: "Client",
      from_email: "c@example.com",
      message: "Hello",
      ai_response: "Thank you for your message.",
    });
    expect(capturedText()).toContain("Réponse auto");
  });

  it("shows manual response warning when no ai_response", async () => {
    await notifyEscalation({
      from_name: "Client",
      from_email: "c@example.com",
      message: "Hello",
    });
    expect(capturedText()).toContain("manuelle requise");
  });

  it("labels email source correctly", async () => {
    await notifyEscalation({
      from_name: "Client",
      from_email: "c@example.com",
      message: "Hello",
      source: "email",
    });
    expect(capturedText()).toContain("📧");
  });
});

// ─── sendEmailApprovalRequest ────────────────────────────────────────────────

describe("sendEmailApprovalRequest", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("includes approve/refuse inline keyboard", async () => {
    await sendEmailApprovalRequest({
      id: "email-123",
      from_name: "Jean",
      from_email: "jean@test.com",
      subject: "RDV",
      original_body: "Bonjour",
      draft_response: "Merci de votre message.",
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const keyboard = body.reply_markup?.inline_keyboard?.[0];
    expect(keyboard).toBeDefined();
    expect(keyboard.some((btn: { callback_data: string }) => btn.callback_data.includes("approve_email-123"))).toBe(true);
    expect(keyboard.some((btn: { callback_data: string }) => btn.callback_data.includes("refuse_email-123"))).toBe(true);
  });

  it("truncates long original_body to 300 chars in preview", async () => {
    await sendEmailApprovalRequest({
      id: "x",
      from_name: "A",
      from_email: "a@b.com",
      subject: "S",
      original_body: "y".repeat(400),
      draft_response: "Short reply",
    });
    const text = capturedText();
    expect(text).toContain("...");
    expect(text.includes("y".repeat(301))).toBe(false);
  });

  it("returns true on success", async () => {
    const result = await sendEmailApprovalRequest({
      id: "ok",
      from_name: "A",
      from_email: "a@b.com",
      subject: "S",
      original_body: "Body",
      draft_response: "Draft",
    });
    expect(result).toBe(true);
  });

  it("returns false when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await sendEmailApprovalRequest({
      id: "fail",
      from_name: "A",
      from_email: "a@b.com",
      subject: "S",
      original_body: "Body",
      draft_response: "Draft",
    });
    expect(result).toBe(false);
  });
});

// ─── notifyLowTwilioBalance ──────────────────────────────────────────────────

describe("notifyLowTwilioBalance", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  afterEach(clearEnv);

  it("includes formatted balance in message", async () => {
    await notifyLowTwilioBalance(4.5);
    expect(capturedText()).toContain("4.50$");
  });

  it.todo("includes Twilio console URL in message");
});

// ─── Échappement HTML du texte client (bug du 25 sept 2026) ──────────────────
//
// Un nom/message client contenant "&", "<" ou ">" fait rejeter TOUT le message
// par Telegram (parse_mode HTML) — et l'échec était avalé en silence, donc une
// alerte "disparaissait" sans trace. Ces tests verrouillent que chaque
// formatter échappe désormais son texte libre.

describe("échappement HTML du texte client (anti-régression)", () => {
  beforeEach(() => {
    setEnv();
    mockFetch.mockClear();
    mockFetchOk();
  });

  it("notifyNewBooking échappe le nom, le téléphone et la note", async () => {
    await notifyNewBooking({
      client_name: "R&D <VIP>",
      client_phone: "+1 418 <555> & co",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
      price: 35,
      note: "Attention < peau sensible & allergies >",
    });
    const text = capturedText();
    expect(text).not.toContain("R&D <VIP>");
    expect(text).toContain("R&amp;D &lt;VIP&gt;");
    expect(text).toContain("&lt;555&gt; &amp; co");
    expect(text).toContain("&lt; peau sensible &amp; allergies &gt;");
  });

  it("notifyBookingCancelled échappe le nom", async () => {
    await notifyBookingCancelled({
      client_name: "Bob & Fils <3",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
    });
    expect(capturedText()).toContain("Bob &amp; Fils &lt;3");
  });

  it("notifyBookingRescheduled échappe le nom", async () => {
    await notifyBookingRescheduled({
      client_name: "Client <Test>",
      service: "Coupe",
      barber: "Melynda",
      old_date: "2026-06-15",
      old_time: "10:00",
      new_date: "2026-06-16",
      new_time: "11:00",
    });
    expect(capturedText()).toContain("Client &lt;Test&gt;");
  });

  it("proposeRescheduleNotification échappe le nom (flux OUI/NON) — un nom cassé bloquait toute la demande", async () => {
    await proposeRescheduleNotification({
      id: "abc123",
      clientName: "Jean & Marie <VIP>",
      service: "Coupe",
      barber: "Melynda",
      oldDate: "2026-06-15",
      oldTime: "10:00",
      newDate: "2026-06-16",
      newTime: "11:00",
      hasPhone: true,
    });
    expect(capturedText()).toContain("Jean &amp; Marie &lt;VIP&gt;");
  });

  it("notifyNoShow échappe le nom et le téléphone", async () => {
    await notifyNoShow({
      client_name: "A&B <Client>",
      client_phone: "+1<418>555",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
    });
    const text = capturedText();
    expect(text).toContain("A&amp;B &lt;Client&gt;");
    expect(text).toContain("+1&lt;418&gt;555");
  });

  it("notifyNoShowDigest échappe chaque client de la liste (une seule case brisait tout le résumé)", async () => {
    await notifyNoShowDigest([
      { client_name: "OK Client", time: "10:00", barber: "Melynda", service: "Coupe" },
      { client_name: "Cassé & <Client>", time: "11:00", barber: "Melynda", service: "Barbe" },
    ]);
    expect(capturedText()).toContain("Cassé &amp; &lt;Client&gt;");
  });

  it("notifyEscalation échappe nom, courriel et message", async () => {
    await notifyEscalation({
      from_name: "Client <VIP>",
      from_email: "test&client@example.com",
      message: "J'ai une question <urgente> & importante",
    });
    const text = capturedText();
    expect(text).toContain("Client &lt;VIP&gt;");
    expect(text).toContain("test&amp;client@example.com");
    expect(text).toContain("&lt;urgente&gt; &amp; importante");
  });

  it("notifyMessengerUnreachable échappe le nom, le message et la réponse", async () => {
    await notifyMessengerUnreachable({
      senderName: "Client <Messenger>",
      clientMessage: "Bonjour & bonsoir <test>",
      draftReply: "Réponse <auto> & générée",
      reason: "fenêtre 24h dépassée",
    });
    const text = capturedText();
    expect(text).toContain("Client &lt;Messenger&gt;");
    expect(text).toContain("Bonjour &amp; bonsoir &lt;test&gt;");
    expect(text).toContain("Réponse &lt;auto&gt; &amp; générée");
  });

  it("notifyWaitlistEntry échappe le nom", async () => {
    await notifyWaitlistEntry({
      client_name: "Attente & <Client>",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
    });
    expect(capturedText()).toContain("Attente &amp; &lt;Client&gt;");
  });

  it("un message rejeté par Telegram (400) ne plante pas — juste loggé (avant: avalé en silence)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => "Bad Request: can't parse entities" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewBooking({
      client_name: "Test",
      client_phone: "+14185551234",
      service: "Coupe",
      barber: "Melynda",
      date: "2026-06-15",
      time: "10:00",
      price: 35,
    })).resolves.not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
