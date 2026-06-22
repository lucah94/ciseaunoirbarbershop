import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Simple in-memory rate limiter.
 * Returns null if the request is allowed, or a NextResponse with 429 if rate limited.
 */
export function rateLimit(
  req: NextRequest,
  { limit = 10, windowMs = 60 * 1000 }: { limit?: number; windowMs?: number } = {}
): NextResponse | null {
  cleanup();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `${ip}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez réessayer plus tard." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}

/**
 * Persistent (DB-backed) rate limiter for serverless environments where each
 * container has its own in-memory state. Uses the `rate_limit` table
 * (key text PRIMARY KEY, count int, window_start timestamptz).
 *
 * Returns true if the request is ALLOWED, false if the limit is exceeded.
 * Fail-open: any DB error returns true so real logins are never blocked.
 */
export async function dbRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  try {
    const now = Date.now();

    const { data, error } = await supabaseAdmin
      .from("rate_limit")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      // DB error → fail open
      return true;
    }

    // No row, or the window has expired → start a fresh window.
    if (!data || now - new Date(data.window_start).getTime() >= windowMs) {
      const { error: upsertError } = await supabaseAdmin
        .from("rate_limit")
        .upsert({
          key,
          count: 1,
          window_start: new Date(now).toISOString(),
        });

      if (upsertError) return true;
      return true;
    }

    // Within the active window.
    if (data.count >= limit) {
      return false;
    }

    const { error: updateError } = await supabaseAdmin
      .from("rate_limit")
      .update({ count: data.count + 1 })
      .eq("key", key);

    if (updateError) return true;
    return true;
  } catch {
    // Any unexpected error → fail open.
    return true;
  }
}
