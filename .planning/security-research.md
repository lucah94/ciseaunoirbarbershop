# Security & Auto-Repair Research — Ciseau Noir

**Researched:** 2026-04-01
**Domain:** Next.js 16 / Vercel security hardening
**Confidence:** HIGH (Next.js 16 docs loaded from node_modules; all package versions verified against npm registry)

---

## CRITICAL: Next.js 16 Breaking Change — Middleware Is Now `proxy.ts`

> **`middleware.ts` is deprecated and removed in Next.js 16.0.0.**
> The file must be named `proxy.ts` (or `proxy.js`) in `src/` or the project root.
> The exported function must be named `proxy`, not `middleware`.
> Source: `/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

Migration codemod if needed:
```bash
npx @next/codemod@canary middleware-to-proxy .
```

The `src/proxy.ts` file already exists in this project (confirmed at `src/proxy.ts`) but is currently empty.

---

## 1. Security Headers (`next.config.ts`)

### Current State

`next.config.ts` already has a solid baseline with: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`, `HSTS`, and a `Content-Security-Policy`.

### What Needs Improvement

**Confidence: HIGH** — Source: Next.js 16 official docs (`content-security-policy.md`, `headers.md`)

**Problem 1 — `unsafe-inline` in CSP script-src:**
The current CSP uses `'unsafe-inline'` and `'unsafe-eval'` in `script-src`. This substantially weakens XSS protection. The Next.js 16 recommended approach is nonce-based CSP via `proxy.ts`, which moves CSP generation to the proxy layer (per-request nonce) instead of a static header in `next.config.ts`.

**Problem 2 — HSTS missing `preload`:**
Current: `max-age=31536000; includeSubDomains`
Recommended: `max-age=63072000; includeSubDomains; preload` (2 years, eligible for browser preload list)

**Problem 3 — `X-XSS-Protection` is obsolete:**
This header is deprecated and ignored by modern browsers. Modern Chromium-based browsers removed this feature. It can safely be dropped — CSP replaces it.

**Problem 4 — CSP missing `Anthropic API` in `connect-src`:**
The current CSP `connect-src` doesn't include `https://api.anthropic.com`, which will cause Figaro bot fetch calls to be blocked by the browser if triggered client-side (they should be server-only, but worth auditing).

### Recommended Complete Header Set

The best pattern for Next.js 16 is a **two-layer approach**:
- `next.config.ts`: static headers that don't require per-request nonce (HSTS, X-Frame-Options, etc.)
- `proxy.ts`: dynamic CSP with per-request nonce (the only way to remove `unsafe-inline`)

**`next.config.ts` — static headers (no CSP here when using nonce approach):**
```typescript
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // NOTE: X-XSS-Protection deliberately omitted — deprecated, ignored by modern browsers
  // NOTE: CSP is set per-request in proxy.ts with nonce, not here
];
```

**Alternative (simpler) — keep static CSP in `next.config.ts` without nonce:**
If you don't want the complexity of nonces and dynamic rendering requirement, the current approach is acceptable. Just fix HSTS and remove `X-XSS-Protection`. The tradeoff is that `unsafe-inline` remains, which is a lower security grade but still passes most audits for a barbershop app.

**Recommendation for this project:** Use the simpler static approach. The app is not a bank. Adding nonces requires all pages using CSP headers to be dynamically rendered, which has performance and complexity costs not worth it here.

---

## 2. Rate Limiting

### Current State

`src/lib/rate-limit.ts` uses an **in-memory Map** with IP+path as key. This is functional but has one critical flaw: **Vercel serverless functions are stateless** — each function invocation is a fresh process. The in-memory Map is reset on every cold start and not shared across concurrent instances. Under real load, the rate limiter provides no protection.

### Recommended Solution: `@upstash/ratelimit` + Upstash Redis

**Confidence: HIGH** — Already installed at `node_modules/@upstash/ratelimit` (v2.0.8) and `@upstash/redis` (v1.37.0 installed). Latest registry versions are `@upstash/ratelimit@2.0.8` and `@upstash/redis@1.37.0`.

**Why Upstash:**
- HTTP-based (not TCP) — works in Vercel serverless and edge functions
- Free tier: 500K commands/month, up to 10 databases — more than sufficient for a barbershop
- Already installed in this project
- Designed specifically for Vercel + Next.js

**Required env vars to add to Vercel:**
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

**Setup — create a free database at https://console.upstash.com then:**
```typescript
// src/lib/rate-limit-edge.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const rateLimitBooking = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),   // 5 bookings per minute per IP
  prefix: "ciseau-noir:booking",
});

export const rateLimitGeneral = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "60 s"),  // 30 req/min for general API
  prefix: "ciseau-noir:general",
});

export const rateLimitFigaro = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"),  // 10 Figaro AI calls per minute
  prefix: "ciseau-noir:figaro",
});
```

**Usage in a route handler:**
```typescript
import { rateLimitBooking } from "@/lib/rate-limit-edge";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await rateLimitBooking.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  // ... rest of handler
}
```

**Algorithms available:**
- `Ratelimit.slidingWindow(N, "duration")` — recommended, prevents burst gaming
- `Ratelimit.fixedWindow(N, "duration")` — simpler but allows 2x burst at window boundaries
- `Ratelimit.tokenBucket(capacity, refillRate, "duration")` — for burst-tolerant endpoints

**Keep existing `rate-limit.ts` as fallback** if Upstash env vars are not set (dev environment).

---

## 3. Input Sanitization

### Current State

`src/lib/sanitize.ts` has only `escapeHtml()` for email HTML output. This is correct usage but covers only one scenario.

### What's Missing

**Confidence: HIGH** — Zod v4 is already in the project at `^4.3.6`.

**The gap:** API route handlers accept raw JSON bodies without schema validation. An attacker can send `{"client_name": "<script>alert(1)</script>", "price": -99999}` to booking routes.

### Recommended Pattern: Zod Schema + Transform for Sanitization

Zod validates types. Add `.transform()` to strip/escape dangerous characters where needed. This covers:
- Type coercion attacks (sending string where number expected)
- Oversized payloads (use `.max()`)
- SQL injection (Supabase uses parameterized queries by default — LOW risk, but Zod type-checks prevent unexpected types)
- XSS in stored data (strip HTML tags before DB insert)

```typescript
// src/lib/schemas/booking.ts
import { z } from "zod";

// Strip HTML tags from string inputs (stored in DB, later rendered)
const safeString = (maxLen: number) =>
  z.string()
    .max(maxLen, "Trop long")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim());

const safePhone = z.string()
  .regex(/^[\d\s\-\+\(\)]{7,20}$/, "Numéro invalide");

const safeEmail = z.string().email("Email invalide").max(254);

export const BookingSchema = z.object({
  client_name: safeString(100),
  client_phone: safePhone,
  client_email: safeEmail.optional(),
  service: safeString(100),
  barber: z.enum(["Melynda", "Diodis"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
  note: safeString(500).optional(),
  price: z.number().min(0).max(500),
});

// In route handler:
const result = BookingSchema.safeParse(await req.json());
if (!result.success) {
  return NextResponse.json(
    { error: "Données invalides", details: result.error.flatten() },
    { status: 400 }
  );
}
const booking = result.data; // fully typed and sanitized
```

**Key point:** `escapeHtml()` in `src/lib/sanitize.ts` should remain for email template rendering. Zod `.transform()` strip-HTML is for data stored in Supabase. These are two different defense layers.

**Don't hand-roll:** Zod's `.email()`, `.url()`, `.regex()` validators are battle-tested. Don't write custom regex for email validation.

---

## 4. Health Check System (`/api/health`)

### What to Check

**Confidence: MEDIUM** — Based on official Supabase, Twilio, and Resend API docs + community patterns.

No dedicated "ping" endpoint exists for any of these three services. The standard pattern is a **lightweight authenticated query** that verifies credentials work:

| Service | Check Method | What It Verifies |
|---------|-------------|-----------------|
| Supabase | `supabase.from("bookings").select("id").limit(1)` | DB connection + RLS anon key |
| Twilio | `client.api.accounts(SID).fetch()` | Account SID + Auth Token valid |
| Resend | `GET https://api.resend.com/domains` with Bearer token | API key valid |
| Anthropic | `fetch("https://api.anthropic.com/v1/models")` with x-api-key | API key valid |

**PostgREST `/live` endpoint:** PostgREST exposes `/live` and `/ready` health endpoints on an admin port (default 3001), but this port is not exposed on Supabase Cloud — only on self-hosted. Do not use this for Supabase Cloud health checks.

### Recommended `/api/health/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import twilio from "twilio";
import { sendSMS } from "@/lib/sms";

// Optional: protect the endpoint from public scraping
// Leave open for Vercel cron / internal monitoring
const HEALTH_SECRET = process.env.HEALTH_SECRET;

export const dynamic = "force-dynamic";

async function checkSupabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .limit(1);
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function checkTwilio(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function checkResend(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

export async function GET(req: Request) {
  // Optional auth check
  if (HEALTH_SECRET) {
    const token = req.headers.get("x-health-secret");
    if (token !== HEALTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [supabase, twilioCheck, resend] = await Promise.all([
    checkSupabase(),
    checkTwilio(),
    checkResend(),
  ]);

  const allOk = supabase.ok && twilioCheck.ok && resend.ok;
  const status = { supabase, twilio: twilioCheck, resend, timestamp: new Date().toISOString() };

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks: status },
    { status: allOk ? 200 : 503 }
  );
}
```

---

## 5. Auto-Alert System (Health Check Failure → SMS)

### Pattern

**Confidence: HIGH** — Uses existing `sendSMS()` from `src/lib/sms.ts` and `MELYNDA_PHONE` env var already in the project.

The auto-alert integrates into the health check cron. Add a new cron job to `vercel.json`:

```json
{
  "path": "/api/cron/health-check",
  "schedule": "*/15 * * * *"
}
```

```typescript
// src/app/api/cron/health-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";

// Track last alert time in Supabase or use a simple KV to avoid SMS spam
// Simple approach: check state in Supabase table "health_alerts"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Call the health check endpoint internally
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const res = await fetch(`${siteUrl}/api/health`, {
    headers: process.env.HEALTH_SECRET
      ? { "x-health-secret": process.env.HEALTH_SECRET }
      : {},
  });

  if (res.ok) {
    // All good — no alert needed
    return NextResponse.json({ status: "ok" });
  }

  const data = await res.json();
  const adminPhone = process.env.MELYNDA_PHONE || process.env.ADMIN_PHONE;

  if (!adminPhone) {
    return NextResponse.json({ error: "No admin phone configured" }, { status: 500 });
  }

  // Build alert message
  const failing = Object.entries(data.checks as Record<string, { ok: boolean }>)
    .filter(([, v]) => !v.ok)
    .map(([k]) => k)
    .join(", ");

  await sendSMS(
    adminPhone,
    `⚠️ Ciseau Noir — Service dégradé !\n\nProblème détecté : ${failing}\n\nVérifier : ${siteUrl}/api/health`
  );

  return NextResponse.json({ status: "alert_sent", failing });
}
```

**Alert spam prevention:** The simplest approach without extra infrastructure is to debounce by storing the last alert timestamp in a Supabase table. Create a `system_events` table with `(type, created_at)` and skip sending if a `health_alert` event exists in the last 30 minutes.

---

## 6. Proxy-Level Protection (`src/proxy.ts`)

### Critical: File Exists But Is Empty

`src/proxy.ts` exists but exports nothing. In Next.js 16 this file is the replacement for `middleware.ts`. It currently does nothing.

### What to Implement

**Confidence: HIGH** — Source: `proxy.md` from Next.js 16 docs.

**Goals:**
1. Block obvious malicious bots (scrapers, scanners) on API routes
2. Optionally: per-IP header injection for tracing
3. Do NOT put heavy auth logic here (per Next.js 16 docs — auth belongs in route handlers)

**Recommended `src/proxy.ts`:**
```typescript
import { NextRequest, NextResponse } from "next/server";

// Known malicious bot User-Agent patterns (no external dependency)
// isbot npm package (v5.1.37) is an option but adds ~50KB — inline patterns are lighter
const BAD_BOT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /python-requests\/[012]\./i, // generic scanner pattern; allowlist legit ones if needed
  /go-http-client\/[12]\.0$/i,  // raw Go HTTP client (no user agent customization)
  /curl\/[0-9]/i,               // raw curl — block on sensitive API paths only
];

// Paths where we apply strict bot filtering
const SENSITIVE_PATHS = [
  "/api/bookings",
  "/api/admin",
  "/api/figaro",
  "/api/clients",
  "/api/expenses",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";

  // Block obvious scanners on sensitive API paths
  const isSensitivePath = SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
  if (isSensitivePath) {
    const isBadBot = BAD_BOT_PATTERNS.some((pattern) => pattern.test(ua));
    if (isBadBot) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Block requests with no user-agent on booking endpoint (bots)
  if (pathname.startsWith("/api/bookings") && !ua) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on API routes only — skip static assets
    "/api/:path*",
  ],
};
```

**Note on `isbot` npm package:**
`isbot@5.1.37` is available and would cover ~1500 known bot patterns. The tradeoff: it adds weight to the proxy bundle. For this app, the inline patterns above cover the realistic threat model (automated scanners, not sophisticated bots). Legitimate crawlers (Googlebot, etc.) should only ever hit public pages, not API routes.

**Note on Vercel BotID:**
Vercel's BotID feature (free tier available) cannot run inside `proxy.ts` — it must be called from route handlers. It's more sophisticated than UA-matching. Worth considering for the booking form route specifically.

---

## 7. CSP Nonce Approach (Advanced — Optional)

The official Next.js 16 recommended approach for strict CSP is to move the entire CSP header to `proxy.ts` with a per-request nonce:

```typescript
// In proxy.ts — add to the existing proxy function
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  `style-src 'self' 'nonce-${nonce}'`,
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.resend.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

const headers = new Headers(request.headers);
headers.set("x-nonce", nonce);
headers.set("Content-Security-Policy", csp);

const response = NextResponse.next({ request: { headers } });
response.headers.set("Content-Security-Policy", csp);
```

**Tradeoff:** All pages using this nonce must be dynamically rendered (`export const dynamic = "force-dynamic"`). For a barbershop app with mostly dynamic data, this is acceptable but adds server cost. This is the gold standard but optional for this use case.

---

## Summary: What Already Exists vs. What's Missing

| Feature | Current State | Action Required |
|---------|--------------|----------------|
| Security headers | Exists in `next.config.ts` | Fix HSTS `preload`, remove `X-XSS-Protection` |
| CSP | Exists (weak — has `unsafe-inline`) | Optional: move to `proxy.ts` with nonce |
| Rate limiting | Exists — **broken on Vercel** (in-memory) | Replace with Upstash ratelimit |
| Input sanitization | Exists only for email HTML (`escapeHtml`) | Add Zod schemas to API routes |
| Health check | **Does not exist** | Create `/api/health/route.ts` |
| Auto-alert | **Does not exist** | Create `/api/cron/health-check/route.ts` + vercel.json entry |
| Proxy protection | **File exists but empty** | Implement bot blocking in `src/proxy.ts` |

---

## Environment Variables to Add

```bash
# Upstash Redis (create free DB at console.upstash.com)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Health check protection (optional — any random string)
HEALTH_SECRET=some-random-secret-here

# Admin phone for alerts (check if ADMIN_PHONE already in Vercel)
ADMIN_PHONE=+14186655703
```

---

## Package Installation

```bash
# Already installed — no new packages needed for core features
# @upstash/ratelimit@2.0.8  ✓ (in node_modules)
# @upstash/redis@1.37.0     ✓ (in node_modules)
# zod@4.3.6                 ✓ (in node_modules)
# twilio@5.13.0             ✓ (in node_modules)

# Optional — only if you want isbot for proxy:
npm install isbot@5.1.37
```

---

## Common Pitfalls

### Pitfall 1: In-Memory Rate Limiter on Vercel
**What goes wrong:** `rate-limit.ts` uses a `Map`. On Vercel, every function invocation may be a new process. The Map resets — rate limiter does nothing at scale.
**Fix:** Replace with Upstash `@upstash/ratelimit` for production. Keep in-memory as dev fallback.

### Pitfall 2: `middleware.ts` Still Exists (Won't Run in Next.js 16)
**What goes wrong:** If a `middleware.ts` file exists alongside `proxy.ts`, only `proxy.ts` runs. A leftover `middleware.ts` is silently ignored.
**Fix:** Ensure only `src/proxy.ts` exists. Check there's no `src/middleware.ts`.

### Pitfall 3: Twilio SDK in Proxy/Edge Runtime
**What goes wrong:** The Twilio Node.js SDK uses Node.js APIs not available in the Edge runtime. Do NOT import `twilio` inside `proxy.ts`.
**Fix:** All Twilio usage stays in route handlers (Node.js runtime). Proxy only inspects headers/UA.

### Pitfall 4: Health Check Timeout on Vercel
**What goes wrong:** Health cron calls all 3 services in parallel — if any takes >10s, Vercel serverless times out (default 10s limit on Hobby plan).
**Fix:** Use `Promise.allSettled` instead of `Promise.all`, add `AbortController` with 5s timeout per check, and wrap each check in try/catch (already shown in example above).

### Pitfall 5: CSP Blocking Supabase Real-Time
**What goes wrong:** Supabase Realtime uses WebSockets. `connect-src` must include `wss://*.supabase.co` in addition to `https://*.supabase.co`.
**Fix:** Add `wss://*.supabase.co` to `connect-src` in CSP.

### Pitfall 6: Zod v4 API Changes
**What goes wrong:** Zod v4 (installed at `^4.3.6`) has breaking changes from v3. `.flatten()` on errors is renamed to `.formErrors`. The `z.object().strict()` behavior changed.
**Fix:** Use `result.error.flatten()` which still works, but check Zod v4 migration guide for any `.formErrors` renamed methods if issues arise.

---

## Sources

### Primary (HIGH confidence)
- `/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy.ts API, migration from middleware
- `/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` — nonce-based CSP with proxy.ts
- `/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` — security header patterns
- `npm view @upstash/ratelimit version` → `2.0.8`; `npm view @upstash/redis version` → `1.37.0`
- `node_modules/@upstash/ratelimit/README.md` — Upstash ratelimit usage patterns

### Secondary (MEDIUM confidence)
- [Upstash Redis pricing docs](https://upstash.com/docs/redis/overall/pricing) — free tier: 500K commands/month
- [Resend domains API](https://resend.com/docs/api-reference/domains/list-domains) — `GET /domains` as auth/health check
- [Twilio Accounts REST API](https://www.twilio.com/docs/iam/api/account) — `accounts(SID).fetch()` as credential check
- [PostgREST /live endpoint](https://postgrest.org/en/v11/references/admin.html) — not available on Supabase Cloud (admin port closed)

### Tertiary (LOW confidence — needs validation)
- isbot v5 pattern coverage — UA patterns listed are verified; full isbot package breadth not independently verified
