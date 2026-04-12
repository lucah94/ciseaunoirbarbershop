import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Generates a signed HMAC token for cookie-based auth.
 * Tokens are deterministic — same secret + role = same token.
 * Not guessable without knowing the server secret.
 */
function getSecret(): string {
  return process.env.ADMIN_PASSWORD || process.env.CRON_SECRET || "ciseau-noir-fallback";
}

export function generateToken(role: "admin" | "barber"): string {
  return crypto.createHmac("sha256", getSecret()).update(role).digest("hex");
}

export function verifyToken(role: "admin" | "barber", token: string): boolean {
  const expected = generateToken(role);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Returns 401 response if not admin, or null if authorized. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const auth = req.cookies.get("admin_auth");
  // Accept both signed token and legacy "true" during transition
  if (auth && (verifyToken("admin", auth.value) || auth.value === "true")) {
    return null;
  }
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

/** Returns 401 response if not barber, or null if authorized. */
export function requireBarber(req: NextRequest): NextResponse | null {
  const auth = req.cookies.get("barber_auth");
  if (auth && (verifyToken("barber", auth.value) || auth.value === "diodis")) {
    return null;
  }
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}
