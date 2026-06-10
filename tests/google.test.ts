/**
 * Tests for src/lib/google.ts
 *
 * All three exported functions call fetch internally.
 * Strategy: vi.stubGlobal("fetch", vi.fn()) to intercept calls.
 *
 * getAccessToken is private — tested indirectly through the public functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFetch(...responses: Array<{ ok: boolean; status?: number; json?: object; text?: string }>) {
  let call = 0;
  return vi.fn(async () => {
    const resp = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: async () => resp.json ?? {},
      text: async () => resp.text ?? "",
    };
  });
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REFRESH_TOKEN = "test-refresh";
  process.env.GOOGLE_LOCATION_NAME = "accounts/123/locations/456";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_LOCATION_NAME;
});

// ─── fetchGoogleReviews ───────────────────────────────────────────────────────

describe("fetchGoogleReviews", () => {
  it("returns reviews array on success", async () => {
    const reviews = [
      { reviewId: "r1", reviewer: { displayName: "Alice" }, starRating: "FIVE", createTime: "2026-01-01T00:00:00Z" },
    ];
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: true, json: { reviews } },
    ));

    const { fetchGoogleReviews } = await import("@/lib/google");
    const result = await fetchGoogleReviews();
    expect(result.reviews).toEqual(reviews);
    expect(result.error).toBeUndefined();
  });

  it("returns empty array when response has no reviews field", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: true, json: {} },
    ));

    const { fetchGoogleReviews } = await import("@/lib/google");
    const result = await fetchGoogleReviews();
    expect(result.reviews).toEqual([]);
  });

  it("returns error when GMB API returns non-OK", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: false, status: 403 },
    ));

    const { fetchGoogleReviews } = await import("@/lib/google");
    const result = await fetchGoogleReviews();
    expect(result.reviews).toEqual([]);
    expect(result.error).toBe("HTTP 403");
  });

  it("returns error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    const { fetchGoogleReviews } = await import("@/lib/google");
    const result = await fetchGoogleReviews();
    expect(result.reviews).toEqual([]);
    expect(result.error).toContain("network down");
  });
});

// ─── replyToGoogleReview ──────────────────────────────────────────────────────

describe("replyToGoogleReview", () => {
  it("returns success: true on 200", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ));

    const { replyToGoogleReview } = await import("@/lib/google");
    const result = await replyToGoogleReview("accounts/123/locations/456/reviews/r1", "Merci!");
    expect(result.success).toBe(true);
  });

  it("returns error when API rejects the reply", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: false, status: 400, text: "Bad review name" },
    ));

    const { replyToGoogleReview } = await import("@/lib/google");
    const result = await replyToGoogleReview("bad/name", "Reply");
    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 400");
  });

  it("returns error on thrown exception", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }) })
      .mockRejectedValueOnce(new TypeError("fetch failed")),
    );

    const { replyToGoogleReview } = await import("@/lib/google");
    const result = await replyToGoogleReview("x", "y");
    expect(result.success).toBe(false);
    expect(result.error).toContain("fetch failed");
  });
});

// ─── postToGoogleMyBusiness ───────────────────────────────────────────────────

describe("postToGoogleMyBusiness", () => {
  it("returns success: true on 200", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ));

    const { postToGoogleMyBusiness } = await import("@/lib/google");
    const result = await postToGoogleMyBusiness("Promo du mois chez Ciseau Noir ✂️");
    expect(result.success).toBe(true);
  });

  it("includes error body on failure", async () => {
    vi.stubGlobal("fetch", makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: false, status: 429, json: { error: { message: "Quota exceeded" } } },
    ));

    const { postToGoogleMyBusiness } = await import("@/lib/google");
    const result = await postToGoogleMyBusiness("Hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Quota exceeded");
  });

  it("sends BOOK call-to-action pointing to booking page", async () => {
    const fetchMock = makeFetch(
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    );
    vi.stubGlobal("fetch", fetchMock);

    const { postToGoogleMyBusiness } = await import("@/lib/google");
    await postToGoogleMyBusiness("test post");

    const [, localPostCall] = fetchMock.mock.calls;
    const body = JSON.parse((localPostCall[1] as RequestInit).body as string);
    expect(body.callToAction.actionType).toBe("BOOK");
    expect(body.callToAction.url).toContain("ciseaunoirbarbershop.com");
  });
});
