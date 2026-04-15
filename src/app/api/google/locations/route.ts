import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

function html(body: string) {
  return new NextResponse(`
    <html><body style="font-family:monospace;background:#0A0A0A;color:#F5F5F5;padding:40px;line-height:1.8">
      ${body}
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

async function getAccessToken(): Promise<{ token?: string; error?: unknown }> {
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
  if (data.access_token) return { token: data.access_token };
  return { error: data };
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { token: accessToken, error: tokenError } = await getAccessToken();

  if (!accessToken) {
    return html(`
      <h2 style="color:#e55">Token Exchange échoué</h2>
      <pre style="background:#111;padding:20px;color:#ccc">${JSON.stringify(tokenError, null, 2)}</pre>
      <p><a href="/api/google/auth" style="color:#C9A84C">Ré-autoriser Google</a></p>
    `);
  }

  // Try old v4 API first (no quota restriction usually)
  const v4AccountsRes = await fetch("https://mybusiness.googleapis.com/v4/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const v4AccountsData = await v4AccountsRes.json();

  let locationsInfo = "";

  if (v4AccountsData.accounts?.length) {
    const accountName = v4AccountsData.accounts[0].name;

    // Try to get locations via v4
    const v4LocRes = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/locations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const v4LocData = await v4LocRes.json();

    locationsInfo = `
      <h3 style="color:#C9A84C;margin-top:24px">API v4 — Accounts:</h3>
      <pre style="background:#111;padding:16px;color:#C9A84C;white-space:pre-wrap">${JSON.stringify(v4AccountsData, null, 2)}</pre>
      <h3 style="color:#C9A84C;margin-top:24px">API v4 — Locations:</h3>
      <pre style="background:#111;padding:16px;color:#C9A84C;white-space:pre-wrap">${JSON.stringify(v4LocData, null, 2)}</pre>
    `;
  } else {
    // Also try new API as fallback
    const newAccountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const newAccountsData = await newAccountsRes.json();

    locationsInfo = `
      <h3 style="color:#e55;margin-top:24px">API v4 résultat:</h3>
      <pre style="background:#111;padding:16px;color:#ccc;white-space:pre-wrap">${JSON.stringify(v4AccountsData, null, 2)}</pre>
      <h3 style="color:#e55;margin-top:24px">Nouvelle API résultat:</h3>
      <pre style="background:#111;padding:16px;color:#ccc;white-space:pre-wrap">${JSON.stringify(newAccountsData, null, 2)}</pre>
    `;
  }

  return html(`
    <h2 style="color:#C9A84C">Google My Business — Locations</h2>
    <p style="color:#4a4">Access token OK</p>
    ${locationsInfo}
    <hr style="border-color:#333;margin:32px 0">
    <h3 style="color:#fff">Alternative manuelle :</h3>
    <p style="color:#888">Si les APIs ne marchent pas, tu peux trouver ton Location Name ici :</p>
    <ol style="color:#ccc">
      <li>Va sur <a href="https://business.google.com" style="color:#C9A84C" target="_blank">business.google.com</a></li>
      <li>Clique sur ton établissement</li>
      <li>Regarde l'URL — elle contient un ID comme <code style="color:#C9A84C">/location/12345678</code></li>
      <li>Le GOOGLE_LOCATION_NAME sera : <code style="color:#C9A84C">locations/12345678</code></li>
    </ol>
  `);
}
