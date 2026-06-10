import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateToken, verifyToken, requireAdmin, requireBarber } from "@/lib/auth";
import type { NextRequest } from "next/server";

describe("generateToken", () => {
  it("returns a hex string", () => {
    const token = generateToken("admin");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same role returns same token", () => {
    expect(generateToken("admin")).toBe(generateToken("admin"));
    expect(generateToken("barber")).toBe(generateToken("barber"));
  });

  it("produces different tokens for admin vs barber", () => {
    expect(generateToken("admin")).not.toBe(generateToken("barber"));
  });
});

describe("verifyToken", () => {
  it("returns true for the correct admin token", () => {
    const token = generateToken("admin");
    expect(verifyToken("admin", token)).toBe(true);
  });

  it("returns true for the correct barber token", () => {
    const token = generateToken("barber");
    expect(verifyToken("barber", token)).toBe(true);
  });

  it("returns false for admin token used as barber", () => {
    const adminToken = generateToken("admin");
    expect(verifyToken("barber", adminToken)).toBe(false);
  });

  it("returns false for a wrong token value", () => {
    expect(verifyToken("admin", "00".repeat(32))).toBe(false);
  });

  it("returns false for token with wrong length", () => {
    expect(verifyToken("admin", "abc")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(verifyToken("admin", "")).toBe(false);
  });

  it("is timing-safe — does not throw on any input", () => {
    expect(() => verifyToken("admin", "x".repeat(64))).not.toThrow();
  });
});

function makeMockRequest(cookieName: string, cookieValue: string | undefined): NextRequest {
  const cookies = new Map<string, { value: string }>();
  if (cookieValue !== undefined) {
    cookies.set(cookieName, { value: cookieValue });
  }
  return {
    cookies: {
      get: (name: string) => cookies.get(name),
    },
    nextUrl: { pathname: "/api/test" },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

describe("requireAdmin", () => {
  it("returns null (authorized) for a valid admin token", () => {
    const token = generateToken("admin");
    const req = makeMockRequest("admin_auth", token);
    expect(requireAdmin(req)).toBeNull();
  });

  it("returns null for legacy 'true' value (transition period)", () => {
    const req = makeMockRequest("admin_auth", "true");
    expect(requireAdmin(req)).toBeNull();
  });

  it("returns 401 when cookie is missing", () => {
    const req = makeMockRequest("admin_auth", undefined);
    const response = requireAdmin(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it("returns 401 for a barber token used as admin", () => {
    const barberToken = generateToken("barber");
    const req = makeMockRequest("admin_auth", barberToken);
    const response = requireAdmin(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it("returns 401 for a garbage token", () => {
    const req = makeMockRequest("admin_auth", "invalid");
    const response = requireAdmin(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });
});

describe("requireBarber", () => {
  it("returns null for a valid barber token", () => {
    const token = generateToken("barber");
    const req = makeMockRequest("barber_auth", token);
    expect(requireBarber(req)).toBeNull();
  });

  it("returns 401 when cookie is missing", () => {
    const req = makeMockRequest("barber_auth", undefined);
    const response = requireBarber(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it("returns 401 for an admin token used as barber", () => {
    const adminToken = generateToken("admin");
    const req = makeMockRequest("barber_auth", adminToken);
    const response = requireBarber(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it("does NOT accept legacy 'true' for barber (unlike admin)", () => {
    const req = makeMockRequest("barber_auth", "true");
    const response = requireBarber(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });
});
