import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

function makeRequest(ip = "1.2.3.4", pathname = "/api/bookings"): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name === "x-forwarded-for") return ip;
        return null;
      },
    },
    nextUrl: { pathname },
  } as unknown as NextRequest;
}

describe("rateLimit", () => {
  // We use vi.useFakeTimers to control Date.now() in the module
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    const req = makeRequest("10.0.0.1");
    expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();
  });

  it("allows requests up to the limit", () => {
    const req = makeRequest("10.0.0.2");
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();
    }
  });

  it("blocks the request after the limit is exceeded", () => {
    const req = makeRequest("10.0.0.3");
    for (let i = 0; i < 3; i++) rateLimit(req, { limit: 3, windowMs: 60_000 });
    const response = rateLimit(req, { limit: 3, windowMs: 60_000 });
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });

  it("includes Retry-After header when rate limited", async () => {
    const req = makeRequest("10.0.0.4");
    for (let i = 0; i < 10; i++) rateLimit(req, { limit: 10, windowMs: 60_000 });
    const response = rateLimit(req, { limit: 10, windowMs: 60_000 });
    expect(response).not.toBeNull();
    const retryAfter = response!.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("resets after the window expires", () => {
    const req = makeRequest("10.0.0.5");
    for (let i = 0; i < 3; i++) rateLimit(req, { limit: 3, windowMs: 60_000 });
    // Exhaust the limit
    expect(rateLimit(req, { limit: 3, windowMs: 60_000 })?.status).toBe(429);
    // Advance time past the window
    vi.advanceTimersByTime(61_000);
    // Should be allowed again
    expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();
  });

  it("different IPs have independent counters", () => {
    const req1 = makeRequest("192.168.1.1");
    const req2 = makeRequest("192.168.1.2");
    for (let i = 0; i < 3; i++) rateLimit(req1, { limit: 3, windowMs: 60_000 });
    expect(rateLimit(req1, { limit: 3, windowMs: 60_000 })?.status).toBe(429);
    // req2 should still be allowed
    expect(rateLimit(req2, { limit: 3, windowMs: 60_000 })).toBeNull();
  });

  it("different paths have independent counters", () => {
    const req1 = makeRequest("10.0.1.1", "/api/bookings");
    const req2 = makeRequest("10.0.1.1", "/api/contact");
    for (let i = 0; i < 3; i++) rateLimit(req1, { limit: 3, windowMs: 60_000 });
    expect(rateLimit(req1, { limit: 3, windowMs: 60_000 })?.status).toBe(429);
    expect(rateLimit(req2, { limit: 3, windowMs: 60_000 })).toBeNull();
  });

  it("uses 'unknown' when no IP header present", () => {
    const req = {
      headers: { get: () => null },
      nextUrl: { pathname: "/api/test" },
    } as unknown as NextRequest;
    expect(rateLimit(req, { limit: 5, windowMs: 60_000 })).toBeNull();
  });
});
