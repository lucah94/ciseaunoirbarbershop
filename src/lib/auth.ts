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
  if (auth && verifyToken("barber", auth.value)) {
    return null;
  }
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

const normName = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Jeton UNIQUE par barbier — lie le jeton au nom (empêche un barbier de se faire passer pour un autre). */
export function generateBarberToken(name: string): string {
  return crypto.createHmac("sha256", getSecret()).update("barber:" + normName(name)).digest("hex");
}

/**
 * Retourne le NOM du barbier connecté SI son jeton correspond à son nom, sinon null.
 * Sécurise les actions scopées (chaque barbier ne touche qu'à ses affaires).
 * Compat transitoire: accepte aussi l'ancien jeton partagé jusqu'à reconnexion de tous.
 */
export function getAuthedBarber(req: NextRequest): string | null {
  const auth = req.cookies.get("barber_auth")?.value;
  const name = req.cookies.get("barber_name")?.value;
  if (!auth || !name) return null;
  const expected = generateBarberToken(name);
  try {
    if (auth.length === expected.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      return name;
    }
  } catch { /* ignore */ }
  if (verifyToken("barber", auth)) return name; // fallback ancien jeton
  return null;
}
