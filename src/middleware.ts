import { NextRequest, NextResponse } from "next/server";

// ─── Rate limiter en mémoire (Edge-compatible) ────────────────────────────────
// Limite par IP — sliding window simple
const RATE_LIMITS: Record<string, { count: number; resetAt: number }> = {};

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = ip;
  const entry = RATE_LIMITS[key];
  if (!entry || now > entry.resetAt) {
    RATE_LIMITS[key] = { count: 1, resetAt: now + windowMs };
    return true; // OK
  }
  if (entry.count >= limit) return false; // Bloqué
  entry.count++;
  return true;
}

// ─── Patterns suspects (injection, scan, bots) ───────────────────────────────
const BLOCKED_PATTERNS = [
  /\.\.\//,                          // path traversal
  /<script/i,                        // XSS
  /union.*select/i,                  // SQL injection
  /exec\s*\(/i,                      // code injection
  /eval\s*\(/i,
  /javascript:/i,
  /on\w+\s*=/i,                      // event handlers
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /wp-admin/i,                       // WordPress scans
  /phpMyAdmin/i,
  /\.php$/i,
  /\.asp$/i,
  /xmlrpc\.php/i,
];

const BLOCKED_UAS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /python-requests\/2\.[0-3]/i, // old scraper versions
];

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ip = getIP(req);
  const ua = req.headers.get("user-agent") || "";
  const fullUrl = pathname + search;

  // ── 1. Bloquer les bots malveillants ───────────────────────────────────────
  if (BLOCKED_UAS.some(p => p.test(ua))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 2. Bloquer les patterns d'injection dans l'URL ────────────────────────
  if (BLOCKED_PATTERNS.some(p => p.test(fullUrl))) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── 3. Rate limiting sur les routes API sensibles ─────────────────────────
  if (pathname.startsWith("/api/")) {
    // Routes très sensibles : 10 req / minute
    if (
      pathname.includes("/auth/") ||
      pathname.includes("/sms/blast") ||
      pathname.includes("/figaro/campaign") ||
      pathname.includes("/figaro/chat")
    ) {
      if (!rateLimit(`${ip}:strict:${pathname}`, 10, 60_000)) {
        return new NextResponse(
          JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Routes normales : 60 req / minute
    if (!rateLimit(`${ip}:normal`, 60, 60_000)) {
      return new NextResponse(
        JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── 4. Ajouter des headers de sécurité supplémentaires ────────────────────
  const res = NextResponse.next();
  res.headers.set("X-Request-ID", crypto.randomUUID());
  res.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
