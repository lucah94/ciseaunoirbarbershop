/**
 * Tests for src/app/api/admin/test-post/route.ts
 *
 * Covers: admin auth guard, proxying to auto-post cron, times parameter,
 * propagating status codes, error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

const makeRequest = (body?: object) =>
  new NextRequest("http://localhost/api/admin/test-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("POST /api/admin/test-post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("proxies to /api/cron/auto-post with authorization header set to CRON_SECRET");

  it.todo("passes times=1 by default when body is empty");

  it.todo("passes times from request body when provided as a number");

  it.todo("ignores non-numeric times value and defaults to 1");

  it.todo("returns same status code as the proxied auto-post response");

  it.todo("returns proxied JSON response body on success");

  it.todo("returns 500 when fetch to auto-post cron throws");

  it.todo("handles missing request body without throwing (malformed JSON)");
});
