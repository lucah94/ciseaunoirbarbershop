/**
 * Tests for src/app/api/cron/reply-fb-comments/route.ts
 *
 * Covers: auth, fetching page posts & comments, already-replied dedup via
 * Supabase, AI reply generation, posting reply to Facebook Graph API, errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { BALANCED: "test-model" },
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

const makeRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost/api/cron/reply-fb-comments", {
    headers: { authorization: "Bearer test-secret", ...headers },
  });

describe("GET /api/cron/reply-fb-comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.FACEBOOK_PAGE_ID = "page-123";
    process.env.FACEBOOK_ACCESS_TOKEN = "token-abc";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { replied: 0 } when page has no posts");

  it.todo("returns 200 { replied: 0 } when all comments have already been replied to");

  it.todo("skips comments that are already stored in Supabase fb_replied_comments table");

  it.todo("generates AI reply using comment text and commenter name");

  it.todo("posts reply to Facebook Graph API /commentId/comments endpoint");

  it.todo("records replied comment ID in Supabase to prevent duplicate replies");

  it.todo("returns 200 with replied count equal to new comments processed");

  it.todo("returns early when FACEBOOK_PAGE_ID or FACEBOOK_ACCESS_TOKEN is missing");

  it.todo("handles Facebook Graph API error gracefully without crashing");

  it.todo("returns 500 when AI reply generation throws");
});
