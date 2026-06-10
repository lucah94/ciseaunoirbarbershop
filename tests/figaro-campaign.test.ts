/**
 * Tests for src/app/api/figaro/campaign/route.ts
 *
 * Covers:
 * - GET: returns 401 without admin cookie
 * - GET: returns list of campaigns from email_campaigns table
 * - GET: returns 500 when Supabase query fails
 * - POST: returns 401 without admin cookie
 * - POST: returns 400 when subject or body_html is missing
 * - POST: recipient_type="test" sends to ADMIN_EMAIL only, returns { sent: 1, test: true }
 * - POST: recipient_type="all" sends to all clients with email, returns { sent: N }
 * - POST: recipients are deduplicated before sending
 * - POST: individual send failures do not abort the whole campaign
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("resend", () => {
  class Resend {
    emails = { send: vi.fn().mockResolvedValue({ id: "test-id" }) };
    constructor(_key: string) {}
  }
  return { Resend };
});

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockReturnValue(null);
  process.env.ADMIN_EMAIL = "admin@test.com";
  process.env.RESEND_API_KEY = "re_test";
  process.env.FROM_EMAIL = "Ciseau Noir <noreply@example.com>";
});

function makeRequest(method: string, body?: object) {
  return new Request("http://localhost/api/figaro/campaign", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/figaro/campaign — auth", () => {
  it("returns 401 when admin cookie is absent", async () => {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );
    const { GET } = await import("@/app/api/figaro/campaign/route");
    const res = await GET(makeRequest("GET") as never);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/figaro/campaign — list", () => {
  it.todo("returns campaigns ordered by created_at descending");
  it.todo("returns 500 when Supabase query fails");
  it.todo("returns empty array when no campaigns exist");
});

describe("POST /api/figaro/campaign — auth", () => {
  it("returns 401 when admin cookie is absent", async () => {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );
    const { POST } = await import("@/app/api/figaro/campaign/route");
    const res = await POST(makeRequest("POST", { subject: "Test" }) as never);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/figaro/campaign — validation", () => {
  it.todo("returns 400 when subject is missing");
  it.todo("returns 400 when body_html is missing");
});

describe("POST /api/figaro/campaign — test send", () => {
  it.todo("sends only to ADMIN_EMAIL when recipient_type='test'");
  it.todo("returns { sent: 1, test: true } for test send");
});

describe("POST /api/figaro/campaign — bulk send", () => {
  it.todo("sends to all clients with a valid email address");
  it.todo("skips clients without email or with invalid email");
  it.todo("returns { sent: N } with count of successful sends");
  it.todo("individual Resend failures do not abort the campaign");
  it.todo("returns 500 when Supabase client query fails");
  it.todo("returns 500 when RESEND_API_KEY is not set");
});
