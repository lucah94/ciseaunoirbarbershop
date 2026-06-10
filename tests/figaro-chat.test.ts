/**
 * Tests for src/app/api/figaro/chat/route.ts
 *
 * The route embeds structured email/SMS JSON inside AI responses using
 * delimiters: |||EMAIL|||{...}|||END||| and |||SMS|||{...}|||END|||
 *
 * We extract and test that parsing logic here as pure functions, since
 * it is critical business logic (used to send real marketing emails/SMS).
 */
import { describe, it, expect } from "vitest";

// ─── Replicated parsing helpers from route ────────────────────────────────────

function parseEmbeddedData(text: string): {
  cleanText: string;
  email: { subject: string; body: string } | null;
  sms: { body: string } | null;
} {
  let cleanText = text;
  let email: { subject: string; body: string } | null = null;
  let sms: { body: string } | null = null;

  const emailMatch = text.match(/\|\|\|EMAIL\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
  if (emailMatch) {
    try { email = JSON.parse(emailMatch[1]); } catch { /* ignore */ }
    cleanText = cleanText.replace(/\|\|\|EMAIL\|\|\|[\s\S]*?\|\|\|END\|\|\|/, "").trim();
  }

  const smsMatch = text.match(/\|\|\|SMS\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
  if (smsMatch) {
    try { sms = JSON.parse(smsMatch[1]); } catch { /* ignore */ }
    cleanText = cleanText.replace(/\|\|\|SMS\|\|\|[\s\S]*?\|\|\|END\|\|\|/, "").trim();
  }

  return { cleanText, email, sms };
}

// ─── Email extraction ─────────────────────────────────────────────────────────

describe("parseEmbeddedData — email block", () => {
  it("extracts email data when |||EMAIL||| block is present", () => {
    const text = `Voici votre email de promo!\n|||EMAIL|||{"subject":"Promo 20%","body":"Salut!"}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.email).toEqual({ subject: "Promo 20%", body: "Salut!" });
  });

  it("strips the |||EMAIL||| block from cleanText", () => {
    const text = `Voici l'email.\n|||EMAIL|||{"subject":"Test","body":"Bonjour"}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.cleanText).toBe("Voici l'email.");
    expect(result.cleanText).not.toContain("|||EMAIL|||");
  });

  it("returns null email when no |||EMAIL||| block is present", () => {
    const result = parseEmbeddedData("Juste du texte ordinaire.");
    expect(result.email).toBeNull();
  });

  it("returns null email when JSON inside block is malformed", () => {
    const text = `|||EMAIL|||{invalid json}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.email).toBeNull();
  });

  it("handles multi-line email body spanning multiple lines", () => {
    const body = "Ligne 1\nLigne 2\nLigne 3";
    const text = `Texte.\n|||EMAIL|||${JSON.stringify({ subject: "S", body })}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.email?.body).toBe(body);
  });
});

// ─── SMS extraction ───────────────────────────────────────────────────────────

describe("parseEmbeddedData — SMS block", () => {
  it("extracts sms data when |||SMS||| block is present", () => {
    const text = `Voici votre SMS.\n|||SMS|||{"body":"Promo 15% ce week-end. Répondez STOP."}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.sms).toEqual({ body: "Promo 15% ce week-end. Répondez STOP." });
  });

  it("strips the |||SMS||| block from cleanText", () => {
    const text = `Voici le SMS.\n|||SMS|||{"body":"Test SMS"}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.cleanText).toBe("Voici le SMS.");
  });

  it("returns null sms when no |||SMS||| block is present", () => {
    const result = parseEmbeddedData("Aucun SMS ici.");
    expect(result.sms).toBeNull();
  });

  it("returns null sms when JSON inside block is malformed", () => {
    const text = `|||SMS|||{not valid}|||END|||`;
    const result = parseEmbeddedData(text);
    expect(result.sms).toBeNull();
  });
});

// ─── Combined extraction ──────────────────────────────────────────────────────

describe("parseEmbeddedData — combined text", () => {
  it("extracts both email and sms when both blocks are present", () => {
    const text = [
      "Voici les deux!",
      `|||EMAIL|||{"subject":"S","body":"B"}|||END|||`,
      `|||SMS|||{"body":"SMS"}|||END|||`,
    ].join("\n");
    const result = parseEmbeddedData(text);
    expect(result.email?.subject).toBe("S");
    expect(result.sms?.body).toBe("SMS");
    expect(result.cleanText).toBe("Voici les deux!");
  });

  it("preserves cleanText when neither block is present", () => {
    const text = "Juste une suggestion de campagne.";
    const result = parseEmbeddedData(text);
    expect(result.cleanText).toBe(text);
    expect(result.email).toBeNull();
    expect(result.sms).toBeNull();
  });
});

// ─── Route-level tests ────────────────────────────────────────────────────────

describe("POST /api/figaro/chat", () => {
  it.todo("returns 401 when admin cookie is absent");

  it.todo("returns 400 when messages array is absent from body");

  it.todo("returns 400 when messages is an empty array");

  it.todo("calls Claude with MODELS.SMART and the SYSTEM prompt");

  it.todo("returns { text, email: null, sms: null } when AI response has no embedded blocks");

  it.todo("returns { text, email: {...} } when AI response contains |||EMAIL||| block");

  it.todo("returns { text, sms: {...} } when AI response contains |||SMS||| block");

  it.todo("returns 500 when AI client throws an error");
});
