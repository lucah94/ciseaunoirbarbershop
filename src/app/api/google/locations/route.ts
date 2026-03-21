import { NextRequest, NextResponse } from "next/server";

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function GET(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const accessToken = await getAccessToken();

  // Get accounts
  const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const accountsData = await accountsRes.json();

  if (!accountsData.accounts?.length) {
    return new NextResponse(`
      <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px">
        <h2 style="color:#e55">Aucun compte trouvé</h2>
        <pre>${JSON.stringify(accountsData, null, 2)}</pre>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }

  const accountName = accountsData.accounts[0].name;

  // Get locations
  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const locationsData = await locationsRes.json();

  const html = `
    <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px">
      <h2 style="color:#C9A84C">Tes établissements Google My Business</h2>
      <p style="color:#888">Copie le "name" de ton établissement dans .env.local comme GOOGLE_LOCATION_NAME=</p>
      <pre style="background:#111;padding:20px;margin-top:16px;color:#C9A84C">${JSON.stringify(locationsData, null, 2)}</pre>
    </body></html>
  `;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
