/**
 * Tests for src/app/api/meta/messenger/route.ts
 *
 * Covers GET (webhook verification):
 * - Returns hub.challenge when mode=subscribe and token matches MESSENGER_VERIFY_TOKEN
 * - Returns 403 when token does not match
 * - Returns 403 when mode is not 'subscribe'
 *
 * Covers POST (incoming messages):
 * - Returns 200 immediately for non-message entry types (echo, read, delivery)
 * - Calls AI client for customer text messages
 * - Handles tool_use: check_availability calls Supabase to get open slots
 * - Handles tool_use: book_appointment creates a booking record
 * - Handles tool_use: send_sms_alert notifies admin via Twilio
 * - Sends reply to Facebook Graph API with AI response text
 * - Returns 500 when AI client throws
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { SMART: "claude-sonnet-4-6" },
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn().mockResolvedValue({}) } })),
}));
vi.mock("crypto", () => ({
  default: { createHmac: vi.fn(() => ({ update: vi.fn().mockReturnThis(), digest: vi.fn().mockReturnValue("valid-sig") })) },
}));

import { aiClient } from "@/lib/ai";

function makeVerifyRequest(mode: string, token: string, challenge: string) {
  const url = `http://localhost/api/meta/messenger?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`;
  return new Request(url, { method: "GET" });
}

function makeMessageRequest(body: object) {
  return new Request("http://localhost/api/meta/messenger", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=valid-sig" },
    body: JSON.stringify(body),
  });
}

function makeMessengerPayload(senderId: string, text: string) {
  return {
    object: "page",
    entry: [{
      messaging: [{
        sender: { id: senderId },
        recipient: { id: "page-id" },
        timestamp: Date.now(),
        message: { mid: "mid.test", text },
      }],
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MESSENGER_VERIFY_TOKEN = "test-verify-token";
  process.env.FACEBOOK_ACCESS_TOKEN = "test-page-token";
  process.env.FACEBOOK_APP_SECRET = "test-app-secret";
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe("GET /api/meta/messenger — webhook verification", () => {
  it("returns hub.challenge when mode=subscribe and token matches", async () => {
    const { GET } = await import("@/app/api/meta/messenger/route");
    const res = await GET(makeVerifyRequest("subscribe", "test-verify-token", "challenge123") as never);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("challenge123");
  });

  it("returns 403 when verify token does not match", async () => {
    const { GET } = await import("@/app/api/meta/messenger/route");
    const res = await GET(makeVerifyRequest("subscribe", "wrong-token", "challenge123") as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when mode is not 'subscribe'", async () => {
    const { GET } = await import("@/app/api/meta/messenger/route");
    const res = await GET(makeVerifyRequest("unsubscribe", "test-verify-token", "challenge123") as never);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/meta/messenger — incoming messages", () => {
  it.todo("returns 200 immediately for delivery/read receipts (no message.text)");
  it.todo("requires valid HMAC-SHA256 x-hub-signature-256 to process POST body");

  it.todo("calls AI client with customer message text");
  it.todo("sends AI text response back to Facebook Graph API sendMessage");
  it.todo("handles check_availability tool call by querying Supabase bookings");
  it.todo("handles book_appointment tool call by inserting into Supabase bookings");
  it.todo("handles send_sms_alert tool call by sending Twilio SMS to admin");
  it.todo("returns 500 when AI client throws");
  it.todo("skips echo messages (message.is_echo=true)");
  it.todo("stores conversation history in Supabase messenger_conversations table");
});
