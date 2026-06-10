/**
 * Tests for src/app/api/cron/newsletter/route.ts
 *
 * Covers: auth, AI content generation, Resend email dispatch, subscriber
 * fetching from Supabase, invalid JSON fallback, empty subscriber list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { BALANCED: "test-model" },
}));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) },
  })),
}));

const makeRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost/api/cron/newsletter", {
    headers: { authorization: "Bearer test-secret", ...headers },
  });

describe("GET /api/cron/newsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.RESEND_API_KEY = "re_test";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { sent: 0 } when subscriber list is empty");

  it.todo("generates newsletter content using Claude AI with current month in French");

  it.todo("sends email to each subscribed client via Resend");

  it.todo("uses fallback subject when AI returns malformed JSON");

  it.todo("includes unsubscribe footer in each email");

  it.todo("returns 200 with sent count equal to number of subscribers");

  it.todo("returns 500 when Supabase query fails");

  it.todo("returns 500 when Resend throws");

  it.todo("returns 500 when AI generation throws");

  it.todo("skips clients with no email address");
});
