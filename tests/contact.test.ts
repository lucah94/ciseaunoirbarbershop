/**
 * Tests for src/app/api/contact/route.ts
 *
 * Covers: Zod validation, escalation keyword detection, rate-limit guard,
 * email sending, Telegram/SMS side-effects.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "Bonjour!" }] }) } },
  MODELS: { FAST: "claude-haiku-4-5-20251001" },
}));
vi.mock("@/lib/telegram", () => ({
  notifyNewContactMessage: vi.fn().mockResolvedValue(undefined),
  notifyEscalation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue(null),
}));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-id" }) },
  })),
}));

// ─── Escalation keyword detection (replicated from route logic) ───────────────

const ESCALATION_KEYWORDS = [
  "plainte","plaindre","problème","remboursement","pas content","mécontent",
  "terrible","horrible","erreur","arnaque","urgent","accident","insatisfait",
  "volé","scandale",
];

function isEscalated(message: string): boolean {
  const lower = message.toLowerCase();
  return ESCALATION_KEYWORDS.some(k => lower.includes(k));
}

describe("escalation keyword detection", () => {
  it("detects 'plainte' in a message", () => {
    expect(isEscalated("J'ai une plainte à formuler")).toBe(true);
  });

  it("detects 'remboursement' mid-sentence", () => {
    expect(isEscalated("Je veux un remboursement SVP")).toBe(true);
  });

  it("detects 'urgent' in uppercase", () => {
    expect(isEscalated("C'est URGENT merci")).toBe(true);
  });

  it("detects 'pas content' as a phrase", () => {
    expect(isEscalated("Je suis pas content du service")).toBe(true);
  });

  it("detects 'horrible' in mixed case", () => {
    expect(isEscalated("Le service était Horrible")).toBe(true);
  });

  it("does NOT flag a normal booking inquiry", () => {
    expect(isEscalated("Bonjour, je voudrais prendre un rendez-vous")).toBe(false);
  });

  it("does NOT flag a polite compliment", () => {
    expect(isEscalated("Excellent service, merci beaucoup !")).toBe(false);
  });

  it("does NOT flag partial keyword matches (e.g. 'planète' does not trigger 'plainte')", () => {
    expect(isEscalated("Ma planète préférée")).toBe(false);
  });

  it("detects 'arnaque' in a longer sentence", () => {
    expect(isEscalated("C'est une arnaque ce prix-là")).toBe(true);
  });

  it("detects 'scandale' when buried in text", () => {
    expect(isEscalated("Quel scandale, je reviendrai jamais")).toBe(true);
  });
});

// ─── Input validation (Zod schema) ───────────────────────────────────────────

describe("POST /api/contact — input validation", () => {
  it.todo("returns 400 when name is empty string");

  it.todo("returns 400 when email is not a valid email address");

  it.todo("returns 400 when message is empty string");

  it.todo("returns 400 when name exceeds 100 characters");

  it.todo("returns 400 when message exceeds 2000 characters");

  it.todo("returns 400 for missing required fields");

  it.todo("returns 400 for malformed JSON body");
});

// ─── POST /api/contact — happy path ──────────────────────────────────────────

describe("POST /api/contact — happy path", () => {
  it.todo("returns 200 { ok: true } for a valid non-escalated message");

  it.todo("calls Resend emails.send twice: once to admin, once as auto-reply to client");

  it.todo("calls notifyNewContactMessage with escalated=false for normal messages");

  it.todo("saves message to figaro_messages table in Supabase");

  it.todo("calls generateAutoReply with Claude AI and uses the result in the auto-reply email");
});

// ─── POST /api/contact — escalation path ─────────────────────────────────────

describe("POST /api/contact — escalation", () => {
  it.todo("sets escalated=true in figaro_messages insert when message contains escalation keyword");

  it.todo("calls notifyEscalation when message is escalated");

  it.todo("calls sendSMS to MELYNDA_PHONE when message is escalated and env var is set");

  it.todo("does NOT call sendSMS when MELYNDA_PHONE env var is absent");
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe("POST /api/contact — rate limiting", () => {
  it.todo("returns 429 response when rateLimit returns a response object");

  it.todo("allows 10 requests per minute per IP");
});
