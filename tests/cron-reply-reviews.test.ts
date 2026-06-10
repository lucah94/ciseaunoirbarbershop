/**
 * Tests for src/app/api/cron/reply-reviews/route.ts
 *
 * Covers: auth, fetching Google reviews, skipping already-replied reviews,
 * tone selection by star rating, AI reply generation, posting reply to GMB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/google", () => ({
  fetchGoogleReviews: vi.fn(),
  replyToGoogleReview: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { BALANCED: "test-model" },
}));

const makeRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost/api/cron/reply-reviews", {
    headers: { authorization: "Bearer test-secret", ...headers },
  });

describe("GET /api/cron/reply-reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { replied: 0 } when there are no unanswered reviews");

  it.todo("skips reviews that already have a reviewReply");

  it.todo("uses warm, grateful tone prompt for 5-star reviews");

  it.todo("uses professional, attentive tone prompt for 3-star reviews");

  it.todo("uses empathetic, apologetic tone prompt for 1 or 2-star reviews");

  it.todo("generates reply via Claude AI with reviewer name and comment");

  it.todo("handles review with no comment text (undefined comment)");

  it.todo("calls replyToGoogleReview with reviewName and generated reply text");

  it.todo("reply is under 3 sentences as specified in the prompt rules");

  it.todo("returns 200 with replied count matching new reviews processed");

  it.todo("returns 500 when fetchGoogleReviews throws");

  it.todo("returns 500 when replyToGoogleReview throws");
});
