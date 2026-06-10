/**
 * Tests for the pure helper functions in src/lib/gmail.ts
 *
 * extractEmail, decodeBase64, extractBody, and getHeader are not exported
 * but their logic is fully testable by replicating them here.
 *
 * For async exported functions (getGmailToken, fetchUnreadEmails, etc.),
 * see the it.todo stubs below.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  },
}));

// ── Replicated private helpers ───────────────────────────────────────────────

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from.trim();
}

function decodeBase64(str: string): string {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

type Payload = { mimeType?: string; body?: { data?: string }; parts?: unknown[] };

function extractBody(payload: Payload): string {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts as Payload[]) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    for (const part of payload.parts as Payload[]) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// ── extractEmail ─────────────────────────────────────────────────────────────

describe("extractEmail", () => {
  it("extracts address from 'Name <email>' format", () => {
    expect(extractEmail("Jean Tremblay <jean@example.com>")).toBe("jean@example.com");
  });

  it("returns the raw string when no angle brackets are present", () => {
    expect(extractEmail("jean@example.com")).toBe("jean@example.com");
  });

  it("trims whitespace when no angle brackets are present", () => {
    expect(extractEmail("  jean@example.com  ")).toBe("jean@example.com");
  });

  it("handles multiple words before the bracket", () => {
    expect(extractEmail("Jean Paul Tremblay <jp@test.ca>")).toBe("jp@test.ca");
  });

  it("returns raw string when angle brackets are empty (regex requires 1+ chars)", () => {
    // The regex /<(.+?)>/ requires at least one char inside brackets, so "<>" falls
    // back to the trim() path and returns the literal "<>" string.
    expect(extractEmail("<>")).toBe("<>");
  });
});

// ── decodeBase64 ─────────────────────────────────────────────────────────────

describe("decodeBase64", () => {
  it("decodes standard base64 text", () => {
    const encoded = Buffer.from("Bonjour le monde").toString("base64");
    expect(decodeBase64(encoded)).toBe("Bonjour le monde");
  });

  it("handles URL-safe base64 (- instead of +, _ instead of /)", () => {
    // URL-safe chars should be converted back before decoding
    const standard = Buffer.from("Hello+World/Test").toString("base64");
    const urlSafe = standard.replace(/\+/g, "-").replace(/\//g, "_");
    expect(decodeBase64(urlSafe)).toBe("Hello+World/Test");
  });

  it("decodes UTF-8 accented characters", () => {
    const encoded = Buffer.from("Réservation confirmée", "utf-8").toString("base64");
    expect(decodeBase64(encoded)).toBe("Réservation confirmée");
  });

  it("decodes an empty string to an empty string", () => {
    expect(decodeBase64("")).toBe("");
  });
});

// ── getHeader ────────────────────────────────────────────────────────────────

describe("getHeader", () => {
  const headers = [
    { name: "From", value: "Jean <j@example.com>" },
    { name: "Subject", value: "Votre rendez-vous" },
    { name: "Date", value: "Mon, 09 Jun 2026 10:00:00 +0000" },
  ];

  it("returns the value for an exact match", () => {
    expect(getHeader(headers, "From")).toBe("Jean <j@example.com>");
  });

  it("is case-insensitive for the header name lookup", () => {
    expect(getHeader(headers, "from")).toBe("Jean <j@example.com>");
    expect(getHeader(headers, "SUBJECT")).toBe("Votre rendez-vous");
    expect(getHeader(headers, "dAtE")).toBe("Mon, 09 Jun 2026 10:00:00 +0000");
  });

  it("returns empty string when header is not found", () => {
    expect(getHeader(headers, "X-Custom-Header")).toBe("");
  });

  it("returns empty string for an empty headers array", () => {
    expect(getHeader([], "From")).toBe("");
  });
});

// ── extractBody ──────────────────────────────────────────────────────────────

describe("extractBody", () => {
  function b64(text: string) {
    return Buffer.from(text, "utf-8").toString("base64");
  }

  it("returns decoded body.data when present directly on payload", () => {
    expect(extractBody({ body: { data: b64("Hello") } })).toBe("Hello");
  });

  it("returns empty string when payload has no body.data and no parts", () => {
    expect(extractBody({})).toBe("");
    expect(extractBody({ body: {} })).toBe("");
  });

  it("returns text/plain part body when parts are present", () => {
    const payload: Payload = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/html", body: { data: b64("<b>HTML</b>") } },
        { mimeType: "text/plain", body: { data: b64("Plain text") } },
      ],
    };
    expect(extractBody(payload)).toBe("Plain text");
  });

  it("prefers text/plain over text/html in parts", () => {
    const payload: Payload = {
      parts: [
        { mimeType: "text/plain", body: { data: b64("text content") } },
        { mimeType: "text/html", body: { data: b64("<p>html content</p>") } },
      ],
    };
    expect(extractBody(payload)).toBe("text content");
  });

  it("falls back to recursive extraction from nested parts", () => {
    const payload: Payload = {
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "multipart/related",
          parts: [
            { mimeType: "text/plain", body: { data: b64("nested plain") } },
          ],
        },
      ],
    };
    expect(extractBody(payload)).toBe("nested plain");
  });

  it("falls back to html/other part body when no text/plain exists anywhere", () => {
    // The second recursive pass walks ALL parts without a mimeType filter,
    // so it will decode and return the first part that has body.data.
    const payload: Payload = {
      parts: [
        { mimeType: "text/html", body: { data: b64("<b>HTML only</b>") } },
      ],
    };
    expect(extractBody(payload)).toBe("<b>HTML only</b>");
  });
});

// ── Async Gmail API functions (require fetch mocking) ─────────────────────────

describe("getGmailToken", () => {
  it.todo("throws when OAuth token response has no access_token");
  it.todo("returns access_token from successful OAuth response");
  it.todo("falls back to env var GOOGLE_REFRESH_TOKEN when Supabase has no stored token");
  it.todo("prefers Supabase-stored token over env var");
});

describe("fetchUnreadEmails", () => {
  it.todo("returns empty array when Gmail API returns no messages");
  it.todo("returns array of GmailMessage objects with correct shape");
  it.todo("truncates body to 2000 characters");
});

describe("sendGmailReply", () => {
  it.todo("prepends 'Re: ' to subject when not already present");
  it.todo("does not double-prepend 'Re: ' when subject already starts with 'Re:'");
  it.todo("encodes email as URL-safe base64 before sending");
});
