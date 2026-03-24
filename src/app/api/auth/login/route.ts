import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per 2 minutes per IP (brute force protection)
  const rateLimitResponse = rateLimit(req, { limit: 5, windowMs: 2 * 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const { password } = await req.json();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_auth", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_auth");
  return res;
}
