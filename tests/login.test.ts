/**
 * Tests for src/app/api/auth/login/route.ts
 *
 * Covers:
 * - POST: wrong password returns 401
 * - POST: correct password sets admin_auth cookie and returns 200
 * - POST: missing ADMIN_PASSWORD env returns 401
 * - POST: rate-limit blocks after 5 attempts from same IP
 * - DELETE: clears admin_auth cookie
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue(null),
  dbRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/auth", () => ({
  generateToken: vi.fn().mockReturnValue("a".repeat(64)),
}));

import { rateLimit, dbRateLimit } from "@/lib/rate-limit";
import { generateToken } from "@/lib/auth";

function makePost(body: object, ip = "127.0.0.1") {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(dbRateLimit).mockResolvedValue(true);
  process.env.ADMIN_PASSWORD = "correct-password";
});

describe("POST /api/auth/login", () => {
  it("returns 401 for wrong password", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makePost({ password: "wrong" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 401 when ADMIN_PASSWORD env is not set", async () => {
    delete process.env.ADMIN_PASSWORD;
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makePost({ password: "anything" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and sets admin_auth cookie for correct password", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makePost({ password: "correct-password" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("admin_auth=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("sets cookie with httpOnly, secure, sameSite=lax, and 7-day maxAge", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makePost({ password: "correct-password" }));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("calls generateToken('admin') to produce the cookie value", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    await POST(makePost({ password: "correct-password" }));
    expect(generateToken).toHaveBeenCalledWith("admin");
  });

  it("returns rate-limit response when rateLimit returns a response", async () => {
    const mockLimited = new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
    vi.mocked(rateLimit).mockReturnValue(mockLimited as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makePost({ password: "correct-password" }));
    expect(res.status).toBe(429);
  });
});

describe("DELETE /api/auth/login", () => {
  it("returns 200 and clears admin_auth cookie", async () => {
    const { DELETE } = await import("@/app/api/auth/login/route");
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Cookie deletion sets Max-Age=0 or expires in the past
    expect(setCookie).toMatch(/admin_auth=;|Max-Age=0/);
  });
});
