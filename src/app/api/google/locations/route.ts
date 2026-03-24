import { NextRequest, NextResponse } from "next/server";

function html(title: string, color: string, content: string) {
  return new NextResponse(`
    <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px">
      <h2 style="color:${color}">${title}</h2>
      <pre style="background:#111;padding:20px;margin-top:16px;color:#ccc;white-space:pre-wrap">${content}</pre>
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Step 1: Exchange refresh token for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return html("Erreur — Token Exchange échoué", "#e55",
      `Le refresh token n'a pas pu être échangé.\n\n${JSON.stringify(tokenData, null, 2)}\n\nREFRESH_TOKEN commence par: ${(process.env.GOOGLE_REFRESH_TOKEN || "").substring(0, 20)}...`
    );
  }

  const accessToken = tokenData.access_token;

  // Step 2: Get accounts
  const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const accountsData = await accountsRes.json();

  if (!accountsData.accounts?.length) {
    return html("Erreur — Aucun compte trouvé", "#e55",
      `L'access token fonctionne mais aucun compte GMB trouvé.\n\nRéponse API accounts:\n${JSON.stringify(accountsData, null, 2)}\n\nSi tu vois une erreur 403, il faut activer l'API "My Business Account Management" dans Google Cloud Console.`
    );
  }

  const accountName = accountsData.accounts[0].name;

  // Step 3: Get locations
  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const locationsData = await locationsRes.json();

  return html("Tes établissements Google My Business", "#C9A84C",
    `Account: ${accountName}\n\nCopie le "name" de ton établissement dans .env.local comme GOOGLE_LOCATION_NAME=\n\n${JSON.stringify(locationsData, null, 2)}`
  );
}
