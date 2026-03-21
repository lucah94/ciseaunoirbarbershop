import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NODE_ENV === "production"
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  : "http://localhost:3000/api/google/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await res.json();

  // Affiche le refresh token pour que l'admin puisse le copier dans .env
  return new NextResponse(`
    <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px">
      <h2 style="color:#C9A84C">✅ Autorisation Google réussie !</h2>
      <p>Copie cette valeur dans ton .env.local :</p>
      <p style="color:#888">GOOGLE_REFRESH_TOKEN=<strong style="color:#C9A84C">${tokens.refresh_token}</strong></p>
      <p style="margin-top:24px;color:#555">Tu peux fermer cette page.</p>
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}
