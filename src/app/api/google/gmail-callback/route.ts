import { NextRequest, NextResponse } from "next/server";

function html(body: string) {
  return new NextResponse(`
    <html><body style="font-family:Georgia,serif;background:#0A0A0A;color:#F5F5F5;padding:40px;line-height:1.8">
      ${body}
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/gmail-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return html(`
      <h2 style="color:#e55">Erreur — Pas de refresh token</h2>
      <p>Révoque l'accès dans <a href="https://myaccount.google.com/permissions" style="color:#C9A84C" target="_blank">myaccount.google.com/permissions</a> puis réessaie.</p>
      <pre style="background:#111;padding:20px;color:#ccc">${JSON.stringify(tokens, null, 2)}</pre>
    `);
  }

  return html(`
    <h2 style="color:#C9A84C">Gmail autorisé ✓</h2>
    <p>Copie ce token et ajoute-le dans Vercel comme <strong style="color:#C9A84C">GMAIL_REFRESH_TOKEN</strong> :</p>
    <textarea readonly onclick="this.select()" style="width:100%;height:80px;background:#111;color:#C9A84C;border:1px solid #333;padding:12px;font-family:monospace;font-size:13px">${tokens.refresh_token}</textarea>
    <p style="margin-top:24px;color:#888;">Étapes :<br>
    1. Copie le token ci-dessus<br>
    2. Va dans <strong>Vercel → ciseau-noir → Settings → Environment Variables</strong><br>
    3. Ajoute <code style="color:#C9A84C">GMAIL_REFRESH_TOKEN</code> = [token copié]<br>
    4. Redéploie</p>
  `);
}
