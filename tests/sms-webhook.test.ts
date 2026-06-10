/**
 * Tests for src/app/api/sms/webhook/route.ts
 *
 * Covers: STOP/unsubscribe keywords, CONFIRMER/OUI/ANNULER flows,
 * Twilio signature validation bypass, default response.
 *
 * Strategy: import handleSmsBody if extracted to a named export, or test
 * via the POST handler with a mocked Request object + mocked supabaseAdmin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("twilio", () => {
  const validateRequest = vi.fn(() => true);
  return { default: Object.assign(vi.fn(), { validateRequest }) };
});

// Helper to build a URLSearchParams-encoded POST body matching Twilio format
function makeTwilioBody(from: string, body: string): string {
  const p = new URLSearchParams();
  p.set("From", from);
  p.set("Body", body);
  return p.toString();
}

describe("SMS webhook — STOP keywords", () => {
  it.todo("blacklists phone and returns unsubscribe TwiML for 'STOP'");
  it.todo("blacklists phone for 'ARRET'");
  it.todo("blacklists phone for 'UNSUBSCRIBE'");
  it.todo("blacklists phone for 'DESABONNER'");
});

describe("SMS webhook — CONFIRMER", () => {
  it.todo("returns confirmation TwiML when matching bookings exist");
  it.todo("returns 'no booking found' TwiML when no matching bookings");
});

describe("SMS webhook — ANNULER", () => {
  it.todo("cancels the next booking and returns success TwiML when > 1h away");
  it.todo("returns 'too late' TwiML when booking is < 1h away");
  it.todo("returns 'no booking found' TwiML when no matching bookings");
  it.todo("matches phone numbers with +1 prefix vs stored 10-digit format");
});

describe("SMS webhook — Twilio signature validation", () => {
  it.todo("returns 403 when signature is invalid and TWILIO_AUTH_TOKEN is set");
  it.todo("processes request when TWILIO_AUTH_TOKEN is not set (development mode)");
});

describe("SMS webhook — default response", () => {
  it.todo("returns default help TwiML for unrecognized body text");
  it.todo("returns booking URL in default response");
});

describe("SMS webhook — REPRENDRE / RESERVER", () => {
  it.todo("returns booking URL TwiML for 'RESERVER'");
  it.todo("returns booking URL TwiML for 'BONJOUR'");
});
