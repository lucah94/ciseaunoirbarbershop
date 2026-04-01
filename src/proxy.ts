import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Rate limiter Redis (partagé entre toutes les instances Vercel) ───────────
let ratelimitNormal: Ratelimit | null = null;
let ratelimitStrict: Ratelimit | null = null;

function getRatelimiters() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!ratelimitNormal) {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    ratelimitNormal = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:normal" });
    ratelimitStrict = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:strict" });
  }
  return { normal: ratelimitNormal, strict: ratelimitStrict! };
}

// ─── Patterns malveillants ────────────────────────────────────────────────────
const BAD_PATTERNS = [/\.\.\//,/<script/i,/union.*select/i,/exec\s*\(/i,/eval\s*\(/i,/javascript:/i,/\/etc\/passwd/i,/wp-admin/i,/phpMyAdmin/i,/\.php$/i,/xmlrpc\.php/i];
const BAD_UAS = [/sqlmap/i,/nikto/i,/nmap/i,/masscan/i,/zgrab/i];

function getIP(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ip = getIP(req);
  const ua = req.headers.get("user-agent") || "";

  // 1. Bloquer bots malveillants
  if (BAD_UAS.some(p => p.test(ua))) return new NextResponse("Forbidden", { status: 403 });

  // 2. Bloquer patterns injection dans l'URL
  if (BAD_PATTERNS.some(p => p.test(pathname + search))) return new NextResponse("Bad Request", { status: 400 });

  // 3. Rate limiting API (Redis — partagé entre toutes les instances)
  if (pathname.startsWith("/api/")) {
    const limiters = getRatelimiters();
    if (limiters) {
      const isStrict = pathname.includes("/auth/") || pathname.includes("/sms/blast") || pathname.includes("/figaro/campaign") || pathname.includes("/figaro/chat");
      const { success } = await (isStrict ? limiters.strict : limiters.normal).limit(ip);
      if (!success) {
        return new NextResponse(JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }), { status: 429, headers: { "Content-Type": "application/json" } });
      }
    }
  }

  // 4. Protection admin
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const auth = req.cookies.get("admin_auth");
    if (!auth || auth.value !== "true") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)" ],
};
