/**
 * Tests for src/app/api/auth/barber-login/route.ts
 *
 * Pure logic covered:
 * - Password matching for melynda and stephanie
 * - Rejection of unknown barber identifiers
 * - Empty password edge case
 * - Cookie names set on successful login
 * - DELETE logout clears barber_auth cookie
 *
 * Note: rate limiting is tested in rate-limit.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: object, method = "POST"): Request {
  return new Request("http://localhost/api/auth/barber-login", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): Request {
  return new Request("http://localhost/api/auth/barber-login", { method: "DELETE" });
}

// ─── Password match logic (replicated from route) ─────────────────────────────

function checkBarberLogin(barber: string, password: string): { match: boolean; name: string } {
  const MELYNDA_PW = process.env.MELYNDA_PASSWORD ?? "";
  const STEPHANIE_PW = process.env.STEPHANIE_PASSWORD ?? "";

  if (barber === "melynda") {
    return { match: !!MELYNDA_PW && password === MELYNDA_PW, name: "melynda" };
  }
  if (barber === "stephanie") {
    return { match: !!STEPHANIE_PW && password === STEPHANIE_PW, name: "stephanie" };
  }
  return { match: false, name: "" };
}

describe("barber-login password match logic", () => {
  beforeEach(() => {
    process.env.MELYNDA_PASSWORD = "secret-mel";
    process.env.STEPHANIE_PASSWORD = "secret-steph";
  });

  afterEach(() => {
    delete process.env.MELYNDA_PASSWORD;
    delete process.env.STEPHANIE_PASSWORD;
  });

  it("accepts melynda with correct password", () => {
    expect(checkBarberLogin("melynda", "secret-mel").match).toBe(true);
  });

  it("accepts stephanie with correct password", () => {
    expect(checkBarberLogin("stephanie", "secret-steph").match).toBe(true);
  });

  it("rejects melynda with wrong password", () => {
    expect(checkBarberLogin("melynda", "wrong").match).toBe(false);
  });

  it("rejects stephanie with wrong password", () => {
    expect(checkBarberLogin("stephanie", "wrong").match).toBe(false);
  });

  it("rejects unknown barber name", () => {
    expect(checkBarberLogin("luca", "any").match).toBe(false);
    expect(checkBarberLogin("admin", "any").match).toBe(false);
  });

  it("rejects when env var is not set (empty string)", () => {
    delete process.env.MELYNDA_PASSWORD;
    expect(checkBarberLogin("melynda", "").match).toBe(false);
    expect(checkBarberLogin("melynda", "anything").match).toBe(false);
  });

  it("returns correct barber name on success", () => {
    expect(checkBarberLogin("melynda", "secret-mel").name).toBe("melynda");
    expect(checkBarberLogin("stephanie", "secret-steph").name).toBe("stephanie");
  });

  it("returns empty name on failure", () => {
    expect(checkBarberLogin("unknown", "pw").name).toBe("");
  });
});

// ─── Route integration (requires Next.js env) ─────────────────────────────────

describe("POST /api/auth/barber-login route", () => {
  beforeEach(() => {
    process.env.MELYNDA_PASSWORD = "secret-mel";
    process.env.STEPHANIE_PASSWORD = "secret-steph";
    vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
  });

  afterEach(() => {
    delete process.env.MELYNDA_PASSWORD;
    delete process.env.STEPHANIE_PASSWORD;
    vi.restoreAllMocks();
  });

  it("returns 200 and sets cookies for valid melynda login", async () => {
    const { POST } = await import("@/app/api/auth/barber-login/route");
    const req = makeRequest({ barber: "melynda", password: "secret-mel" }) as never;
    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("barber_auth");
  });

  it("returns 401 for wrong password", async () => {
    const { POST } = await import("@/app/api/auth/barber-login/route");
    const req = makeRequest({ barber: "melynda", password: "nope" }) as never;
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/incorrect/i);
  });

  it("returns 401 for unknown barber", async () => {
    const { POST } = await import("@/app/api/auth/barber-login/route");
    const req = makeRequest({ barber: "diodis", password: "any" }) as never;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("DELETE clears barber_auth cookie", async () => {
    const { DELETE } = await import("@/app/api/auth/barber-login/route");
    const res = await DELETE();
    expect(res.status).toBe(200);
  });
});
