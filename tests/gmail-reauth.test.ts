/**
 * Tests for:
 *   src/app/api/admin/gmail-reauth/route.ts          (GET — initiates OAuth flow)
 *   src/app/api/admin/gmail-reauth/callback/route.ts (GET — exchanges code, saves token)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

const makeReauthRequest = (secret?: string) =>
  new NextRequest(`http://localhost/api/admin/gmail-reauth${secret ? `?secret=${secret}` : ""}`);

const makeCallbackRequest = (params: Record<string, string>) => {
  const url = new URL("http://localhost/api/admin/gmail-reauth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
};

describe("GET /api/admin/gmail-reauth (initiate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it.todo("returns 401 when secret query param does not match CRON_SECRET");

  it.todo("redirects to Google OAuth URL when secret is correct");

  it.todo("OAuth redirect URL contains client_id, redirect_uri, response_type=code, and access_type=offline");

  it.todo("OAuth redirect URL includes prompt=consent");

  it.todo("OAuth redirect URL includes state set to CRON_SECRET");
});

describe("GET /api/admin/gmail-reauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it.todo("returns 401 when state param does not match CRON_SECRET");

  it.todo("returns 400 when code param is missing");

  it.todo("exchanges code for tokens via Google OAuth token endpoint");

  it.todo("returns 500 with error when token response has no refresh_token");

  it.todo("saves refresh_token to Supabase settings table when token exchange succeeds");

  it.todo("returns 200 JSON success when token is saved successfully");

  it.todo("returns 500 when Supabase update fails");
});
