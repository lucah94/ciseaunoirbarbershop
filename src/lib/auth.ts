import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Generates a signed HMAC token for cookie-based auth.
 * Tokens are deterministic — same secret + role = same token.
 * Not guessable without knowing the server secret.
 */
function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD || process.env.CRON_SECRET;
  if (!secret) {
    // AUCUN repli codé en dur. L'ancien "ciseau-noir-fallback" était visible dans le
    // code source (donc public) — sur n'importe quel environnement où ADMIN_PASSWORD
    // ET CRON_SECRET sont absents (ex. preview Vercel, machine locale mal configurée),
    // n'importe qui pouvait calculer lui-même un cookie admin_auth valide et entrer
    // dans /admin SANS jamais passer par /api/auth/login — la limite de tentatives et
    // le vrai mot de passe étaient totalement court-circuités. Trouvé en audit le 25
    // sept 2026 (confirmé: ADMIN_PASSWORD et CRON_SECRET ne sont configurés QUE sur
    // Production dans Vercel — un preview les a toujours manqués).
    // Refuser plutôt que d'accepter avec un secret devinable : verifyToken() enveloppe
    // TOUT (y compris cet appel) dans un try/catch → refus propre (401), pas un crash.
    // generateToken()/generateBarberToken() à la connexion ne sont appelés qu'après un
    // vrai mot de passe validé (login/barber-login) — jamais atteints ici en pratique.
    throw new Error("ADMIN_PASSWORD ou CRON_SECRET manquant — authentification refusée (pas de repli).");
  }
  return secret;
}

export function generateToken(role: "admin" | "barber"): string {
  return crypto.createHmac("sha256", getSecret()).update(role).digest("hex");
}

export function verifyToken(role: "admin" | "barber", token: string): boolean {
  // TOUT le calcul est dans le try — si getSecret() refuse (secret manquant), c'est un
  // refus propre (false → 401) plutôt qu'une exception non gérée qui remontait en 500.
  try {
    const expected = generateToken(role);
    if (token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Returns 401 response if not admin, or null if authorized. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const auth = req.cookies.get("admin_auth");
  // Seul le token HMAC signé est accepté. (L'ancien repli "true" était un bypass total :
  // n'importe qui pouvait envoyer le cookie admin_auth=true. Retiré — le login pose déjà
  // generateToken("admin"), donc aucune régression pour les vrais admins.)
  if (auth && verifyToken("admin", auth.value)) {
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
