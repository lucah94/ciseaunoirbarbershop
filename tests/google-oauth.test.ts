/**
 * Tests for:
 *   src/app/api/google/gmail-auth/route.ts     (GET — start Gmail OAuth)
 *   src/app/api/google/gmail-callback/route.ts (GET — exchange code, save token)
 *   src/app/api/google/locations/route.ts      (GET — list GMB locations)
 *   src/app/api/google/post/route.ts           (POST — publish GMB post)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/google", () => ({
  postToGoogleMyBusiness: vi.fn(),
}));

const makeRequest = (path: string, method = "GET", body?: object) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

// ── Gmail OAuth initiation ─────────────────────────────────────────────────

describe("GET /api/google/gmail-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("redirects to Google OAuth URL with gmail.modify scope");

  it.todo("OAuth URL includes access_type=offline and prompt=select_account consent");

  it.todo("redirect_uri points to /api/google/gmail-callback");
});

// ── Gmail OAuth callback ───────────────────────────────────────────────────

describe("GET /api/google/gmail-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it.todo("returns 400 when 'code' query param is missing");

  it.todo("exchanges code for tokens via Google token endpoint");

  it.todo("returns HTML success page when refresh_token is received");

  it.todo("saves refresh_token to environment/settings for Gmail access");

  it.todo("returns HTML error page when token exchange fails");

  it.todo("Content-Type is text/html for success and error responses");
});

// ── Google My Business locations ───────────────────────────────────────────

describe("GET /api/google/locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_REFRESH_TOKEN = "refresh-token";
  });

  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("fetches access token using GOOGLE_REFRESH_TOKEN via token endpoint");

  it.todo("returns HTML list of GMB account locations");

  it.todo("returns HTML error page when access token fetch fails");

  it.todo("returns HTML error page when GMB accounts API returns error");
});

// ── Google My Business post ────────────────────────────────────────────────

describe("POST /api/google/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_REFRESH_TOKEN = "refresh-token";
    process.env.GOOGLE_LOCATION_NAME = "accounts/123/locations/456";
  });

  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("returns 400 when message body is empty or missing");

  it.todo("returns 500 when GOOGLE_REFRESH_TOKEN or GOOGLE_LOCATION_NAME is not set");

  it.todo("calls postToGoogleMyBusiness with the message");

  it.todo("returns 200 { ok: true } when post succeeds");

  it.todo("returns 500 with error message when postToGoogleMyBusiness returns failure");
});
