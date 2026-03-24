import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = "https://ciseau-noir.vercel.app/api/google/callback";

function html(body: string) {
  return new NextResponse(`
    <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px;line-height:1.8">
      ${body}
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  // Step 1: Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return html(`
      <h2 style="color:#e55">Erreur — Pas de refresh token</h2>
      <pre style="background:#111;padding:20px;color:#ccc">${JSON.stringify(tokens, null, 2)}</pre>
      <p style="color:#888">Retourne sur <a href="/api/google/auth" style="color:#C9A84C">/api/google/auth</a> pour réessayer.</p>
    `);
  }

  // Step 2: Use the access token to fetch accounts + locations
  const accessToken = tokens.access_token;
  let accountsHtml = "";
  let locationsHtml = "";

  try {
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const accountsData = await accountsRes.json();
    accountsHtml = `<pre style="background:#111;padding:16px;color:#ccc;white-space:pre-wrap">${JSON.stringify(accountsData, null, 2)}</pre>`;

    if (accountsData.accounts?.length) {
      const accountName = accountsData.accounts[0].name;
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locationsData = await locationsRes.json();
      locationsHtml = `
        <h3 style="color:#C9A84C;margin-top:24px">Locations trouvées :</h3>
        <pre style="background:#111;padding:16px;color:#C9A84C;white-space:pre-wrap">${JSON.stringify(locationsData, null, 2)}</pre>
      `;
    }
  } catch (e) {
    accountsHtml = `<p style="color:#e55">Erreur API: ${String(e)}</p>`;
  }

  return html(`
    <h2 style="color:#C9A84C">Autorisation Google réussie !</h2>

    <h3 style="color:#fff;margin-top:24px">1. GOOGLE_REFRESH_TOKEN :</h3>
    <textarea readonly onclick="this.select()" style="width:100%;height:60px;background:#111;color:#C9A84C;border:1px solid #333;padding:12px;font-family:monospace;font-size:14px">${tokens.refresh_token}</textarea>

    <h3 style="color:#fff;margin-top:24px">2. Comptes Google Business :</h3>
    ${accountsHtml}
    ${locationsHtml}

    <p style="margin-top:24px;color:#888">Copie le refresh token ci-dessus (clique dessus pour sélectionner tout).</p>
  `);
}
