/**
 * Tests for src/app/api/reviews/route.ts
 *
 * Covers:
 * - Returns 500 when GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID env vars are missing
 * - Returns 500 when Google Places API returns non-OK status
 * - Returns { reviews, rating, total } on success
 * - reviews defaults to [] when Google API returns no reviews
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

function makeFetch(ok: boolean, json: object) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => json,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  process.env.GOOGLE_PLACE_ID = "ChIJtest123";
});

describe("GET /api/reviews", () => {
  it("returns 500 when GOOGLE_PLACES_API_KEY is not set", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const { GET } = await import("@/app/api/reviews/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 when GOOGLE_PLACE_ID is not set", async () => {
    delete process.env.GOOGLE_PLACE_ID;
    const { GET } = await import("@/app/api/reviews/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 when Google Places API returns non-OK status", async () => {
    vi.stubGlobal("fetch", makeFetch(true, { status: "REQUEST_DENIED" }));
    const { GET } = await import("@/app/api/reviews/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("REQUEST_DENIED");
  });

  it("returns { reviews, rating, total } on success", async () => {
    vi.stubGlobal("fetch", makeFetch(true, {
      status: "OK",
      result: {
        reviews: [{ author_name: "Alice", rating: 5, text: "Super!" }],
        rating: 4.9,
        user_ratings_total: 42,
      },
    }));
    const { GET } = await import("@/app/api/reviews/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rating).toBe(4.9);
    expect(json.total).toBe(42);
    expect(json.reviews).toHaveLength(1);
  });

  it("returns empty reviews array when Google Places result has no reviews", async () => {
    vi.stubGlobal("fetch", makeFetch(true, {
      status: "OK",
      result: { rating: 5.0, user_ratings_total: 0 },
    }));
    const { GET } = await import("@/app/api/reviews/route");
    const res = await GET();
    const json = await res.json();
    expect(json.reviews).toEqual([]);
  });
});
