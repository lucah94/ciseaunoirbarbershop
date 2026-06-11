import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateBarberToken } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const { barber, password } = await req.json();

  let passwordMatch = false;
  let barberName = "";

  if (barber === "melynda") {
    passwordMatch = !!process.env.MELYNDA_PASSWORD && password === process.env.MELYNDA_PASSWORD;
    barberName = "melynda";
  } else if (barber === "stephanie") {
    passwordMatch = !!process.env.STEPHANIE_PASSWORD && password === process.env.STEPHANIE_PASSWORD;
    barberName = "stephanie";
  }

  if (!passwordMatch) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, barber: barberName });
  res.cookies.set("barber_auth", generateBarberToken(barberName), {
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  res.cookies.set("barber_name", barberName, {
    httpOnly: false, secure: true, sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("barber_auth");
  return res;
}
