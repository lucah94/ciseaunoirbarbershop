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

import { isStopIntent } from "@/app/api/sms/webhook/route";

describe("isStopIntent — détection élargie de désinscription", () => {
  it("attrape les mots-clés durs, avec ou sans accent/casse", () => {
    for (const s of ["STOP", "stop", "Stop", "ARRÊTER", "arrêter", "ARRETER", "arreter",
                     "désabonner", "DESABONNER", "unsubscribe", "désinscrire", "opt out", "OPTOUT"]) {
      expect(isStopIntent(s), s).toBe(true);
    }
  });

  it("attrape les formulations naturelles", () => {
    for (const s of [
      "arrêtez svp",
      "Arretez de m'envoyer des textos",
      "enlevez-moi de la liste",
      "enlève moi de votre liste s'il vous plait",
      "retirez mon numéro",
      "je veux plus recevoir de sms",
      "plus de messages svp",
      "ne plus me texter",
      "supprimez moi de la liste",
    ]) {
      expect(isStopIntent(s), s).toBe(true);
    }
  });

  it("ne confond PAS avec la gestion d'un rendez-vous", () => {
    for (const s of [
      "ANNULER",
      "annuler mon rdv",
      "je veux annuler mon rendez-vous",
      "reporter mon rdv svp",
      "CONFIRMER",
      "OUI",
      "bonjour je veux un rdv",
      "arrêter mon rdv de demain",
    ]) {
      expect(isStopIntent(s), s).toBe(false);
    }
  });

  it("ignore le vide et le bruit", () => {
    for (const s of ["", "   ", "merci beaucoup", "à demain", "👍"]) {
      expect(isStopIntent(s), JSON.stringify(s)).toBe(false);
    }
  });
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
