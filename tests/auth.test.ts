import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("REJECTS legacy 'true' value (bypass retiré — faille sécurité)", () => {
    const req = makeMockRequest("admin_auth", "true");
    const response = requireAdmin(req);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
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

// ─── Faille corrigée le 25 sept 2026 : plus AUCUN repli codé en dur ──────────
//
// Avant: getSecret() retombait sur la chaîne "ciseau-noir-fallback" si
// ADMIN_PASSWORD et CRON_SECRET étaient absents. Cette chaîne était visible dans
// le code source (donc publique) — sur un environnement qui n'a ni l'un ni
// l'autre configuré (confirmé: c'était le cas de TOUS les previews Vercel de ce
// projet), n'importe qui pouvait calculer lui-même un cookie admin_auth valide
// et entrer dans /admin sans jamais toucher /api/auth/login — aucun mot de
// passe, aucune limite de tentatives. Ces tests verrouillent le refus.

describe("getSecret — aucun repli codé en dur (faille corrigée)", () => {
  const savedAdmin = process.env.ADMIN_PASSWORD;
  const savedCron = process.env.CRON_SECRET;

  beforeEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (savedAdmin !== undefined) process.env.ADMIN_PASSWORD = savedAdmin;
    if (savedCron !== undefined) process.env.CRON_SECRET = savedCron;
  });

  it("verifyToken refuse (false) quand aucun secret n'est configuré — même avec l'ANCIEN jeton fallback", () => {
    // Le jeton que l'ancien code aurait accepté (HMAC-SHA256 de "admin" avec la
    // chaîne fallback qui était visible dans le code source public).
    const crypto = require("crypto");
    const oldFallbackToken = crypto.createHmac("sha256", "ciseau-noir-fallback").update("admin").digest("hex");
    expect(verifyToken("admin", oldFallbackToken)).toBe(false);
  });

  it("requireAdmin refuse (401) quand aucun secret n'est configuré, même avec l'ancien jeton fallback", () => {
    const crypto = require("crypto");
    const oldFallbackToken = crypto.createHmac("sha256", "ciseau-noir-fallback").update("admin").digest("hex");
    const req = {
      cookies: { get: (name: string) => (name === "admin_auth" ? { value: oldFallbackToken } : undefined) },
    } as unknown as NextRequest;
    const res = requireAdmin(req);
    expect(res?.status).toBe(401);
  });

  it("generateToken lève une erreur claire plutôt que d'utiliser un secret devinable", () => {
    expect(() => generateToken("admin")).toThrow(/ADMIN_PASSWORD ou CRON_SECRET manquant/);
  });
});
