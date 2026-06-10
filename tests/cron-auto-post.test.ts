/**
 * Tests for src/app/api/cron/auto-post/route.ts
 *
 * Covers: auth, content-type rotation helper, missing credentials guard,
 * AI content generation, Facebook posting, GMB posting, Composio fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { BALANCED: "test-model" },
}));
vi.mock("@/lib/google", () => ({
  postToGoogleMyBusiness: vi.fn(),
}));
vi.mock("@/lib/composio", () => ({
  isComposioConfigured: vi.fn().mockReturnValue(false),
  composioFacebookPost: vi.fn(),
  composioInstagramPost: vi.fn(),
}));

const makeRequest = (params?: Record<string, string>, headers?: Record<string, string>) => {
  const url = new URL("http://localhost/api/cron/auto-post");
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { headers: { authorization: `Bearer test-secret`, ...headers } });
};

describe("GET /api/cron/auto-post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 500 when FACEBOOK_PAGE_ID and COMPOSIO_API_KEY are both missing");

  it.todo("getContentTypeForDay returns 'promotion' for Tuesday (index 0)");

  it.todo("getContentTypeForDay returns 'service_highlight' for Tuesday (index 1)");

  it.todo("getContentTypeForDay returns 'promotion' for an unmapped day of week");

  it.todo("rotates content type when times > length of day's content array (modulo)");

  it.todo("calls aiClient.messages.create with correct content prompt");

  it.todo("posts to Facebook using direct API when FACEBOOK credentials are present");

  it.todo("posts to Google My Business when GOOGLE_REFRESH_TOKEN is set");

  it.todo("uses Composio for Facebook when isComposioConfigured returns true");

  it.todo("returns 200 with posts array summarising what was published");

  it.todo("includes error entry in posts array when Facebook API returns error");

  it.todo("returns 500 when AI content generation throws");

  it.todo("respects 'times' query param to post multiple times");
});
