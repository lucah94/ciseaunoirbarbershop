import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const { password } = await req.json();
  const BARBER_PASSWORD = process.env.DIODIS_PASSWORD;
  if (!BARBER_PASSWORD || password !== BARBER_PASSWORD) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("barber_auth", generateToken("barber"), {
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("barber_auth");
  return res;
}
