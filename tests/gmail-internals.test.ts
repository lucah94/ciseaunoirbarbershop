/**
 * Tests for internal helper functions in src/lib/gmail.ts
 *
 * The functions extractEmail, decodeBase64, extractBody, and getHeader are
 * module-private (not exported). This file tests equivalent implementations
 * to document and verify expected behavior.
 *
 * When these helpers are exported in the future, replace the local copies
 * with direct imports.
 */
import { describe, it, expect } from "vitest";

// ─── extractEmail ─────────────────────────────────────────────────────────────

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from.trim();
}

describe("extractEmail", () => {
  it("extracts email from 'Name <email@example.com>' format", () => {
    expect(extractEmail("Alice Dupont <alice@example.com>")).toBe("alice@example.com");
  });

  it("returns the raw string when no angle brackets are present", () => {
    expect(extractEmail("alice@example.com")).toBe("alice@example.com");
  });

  it("trims whitespace from raw email addresses", () => {
    expect(extractEmail("  alice@example.com  ")).toBe("alice@example.com");
  });

  it("handles multiple angle-bracket pairs by extracting the first match", () => {
    expect(extractEmail("Foo <bar@foo.com> <baz@foo.com>")).toBe("bar@foo.com");
  });

  it("returns empty string for empty input", () => {
    expect(extractEmail("")).toBe("");
  });

  it("handles names with accented characters", () => {
    expect(extractEmail("Mélynda Tremblay <melynda@example.com>")).toBe("melynda@example.com");
  });
});

// ─── decodeBase64 (Gmail URL-safe base64) ─────────────────────────────────────

function decodeBase64(str: string): string {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

describe("decodeBase64 (Gmail URL-safe base64)", () => {
  it("decodes a standard ASCII string", () => {
    const encoded = Buffer.from("Hello World").toString("base64");
    expect(decodeBase64(encoded)).toBe("Hello World");
  });

  it("decodes URL-safe base64 with - replaced for + and _ for /", () => {
    // URL-safe base64: + → -, / → _
    const standard = Buffer.from("Hello+World/Test").toString("base64");
    const urlSafe = standard.replace(/\+/g, "-").replace(/\//g, "_");
    expect(decodeBase64(urlSafe)).toBe("Hello+World/Test");
  });

  it("decodes UTF-8 content with accented French characters", () => {
    const text = "Bonjour Mélynda, ça va bien?";
    const encoded = Buffer.from(text).toString("base64");
    expect(decodeBase64(encoded)).toBe(text);
  });

  it("returns empty string for empty input", () => {
    expect(decodeBase64("")).toBe("");
  });
});

// ─── extractBody ──────────────────────────────────────────────────────────────

type Payload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: unknown[];
};

function extractBody(payload: Payload): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts as Payload[]) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts as Payload[]) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("extractBody", () => {
  it("returns decoded body when payload.body.data exists directly", () => {
    const payload = { body: { data: b64("Direct body text") } };
    expect(extractBody(payload)).toBe("Direct body text");
  });

  it("returns empty string when payload has no body.data and no parts", () => {
    expect(extractBody({})).toBe("");
    expect(extractBody({ body: {} })).toBe("");
  });

  it("extracts text/plain from parts array", () => {
    const payload = {
      parts: [
        { mimeType: "text/html", body: { data: b64("<b>HTML</b>") } },
        { mimeType: "text/plain", body: { data: b64("Plain text") } },
      ],
    };
    expect(extractBody(payload)).toBe("Plain text");
  });

  it("prefers text/plain over text/html when both are present in parts", () => {
    const payload = {
      parts: [
        { mimeType: "text/plain", body: { data: b64("Plain") } },
        { mimeType: "text/html", body: { data: b64("<b>HTML</b>") } },
      ],
    };
    expect(extractBody(payload)).toBe("Plain");
  });

  it("recursively searches nested parts when top-level has no text/plain", () => {
    const payload = {
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: b64("Nested plain") } },
          ],
        },
      ],
    };
    expect(extractBody(payload)).toBe("Nested plain");
  });

  it("returns empty string when parts array is empty", () => {
    expect(extractBody({ parts: [] })).toBe("");
  });
});

// ─── getHeader ────────────────────────────────────────────────────────────────

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

describe("getHeader", () => {
  const headers = [
    { name: "From", value: "Alice <alice@example.com>" },
    { name: "Subject", value: "Test subject" },
    { name: "Date", value: "Mon, 9 Jun 2026 10:00:00 +0000" },
  ];

  it("returns the header value by exact name match", () => {
    expect(getHeader(headers, "From")).toBe("Alice <alice@example.com>");
  });

  it("is case-insensitive (from vs FROM vs From)", () => {
    expect(getHeader(headers, "from")).toBe("Alice <alice@example.com>");
    expect(getHeader(headers, "FROM")).toBe("Alice <alice@example.com>");
    expect(getHeader(headers, "From")).toBe("Alice <alice@example.com>");
  });

  it("returns empty string when header is not found", () => {
    expect(getHeader(headers, "Reply-To")).toBe("");
  });

  it("returns empty string for empty headers array", () => {
    expect(getHeader([], "From")).toBe("");
  });
});
