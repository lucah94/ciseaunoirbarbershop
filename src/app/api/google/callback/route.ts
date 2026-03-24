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

  // Exchange code for tokens
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

  if (!tokens.access_token) {
    return html(`
      <h2 style="color:#e55">Erreur — Pas de tokens</h2>
      <pre style="background:#111;padding:20px;color:#ccc">${JSON.stringify(tokens, null, 2)}</pre>
    `);
  }

  // Use the FRESH access token immediately to fetch accounts + locations
  const accessToken = tokens.access_token;

  // Try v4 API
  let accountsResult = "";
  let locationsResult = "";
  let locationName = "";

  try {
    const v4Res = await fetch("https://mybusiness.googleapis.com/v4/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const v4Data = await v4Res.json();
    accountsResult = JSON.stringify(v4Data, null, 2);

    if (v4Data.accounts?.length) {
      const accName = v4Data.accounts[0].name;
      const locRes = await fetch(`https://mybusiness.googleapis.com/v4/${accName}/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const locData = await locRes.json();
      locationsResult = JSON.stringify(locData, null, 2);

      if (locData.locations?.length) {
        locationName = locData.locations[0].name;
      }
    }
  } catch (e) {
    accountsResult = `Error: ${String(e)}`;
  }

  // If v4 didn't work, try new API
  if (!locationName) {
    try {
      const newRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const newData = await newRes.json();

      if (!accountsResult.includes("accounts")) {
        accountsResult = JSON.stringify(newData, null, 2);
      } else {
        accountsResult += "\n\n--- Nouvelle API ---\n" + JSON.stringify(newData, null, 2);
      }

      if (newData.accounts?.length) {
        const accName = newData.accounts[0].name;
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accName}/locations?readMask=name,title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const locData = await locRes.json();
        locationsResult += "\n\n--- Nouvelle API locations ---\n" + JSON.stringify(locData, null, 2);

        if (locData.locations?.length) {
          locationName = locData.locations[0].name;
        }
      }
    } catch (e) {
      accountsResult += `\nNew API Error: ${String(e)}`;
    }
  }

  const refreshSection = tokens.refresh_token ? `
    <h3 style="color:#C9A84C">GOOGLE_REFRESH_TOKEN :</h3>
    <textarea readonly onclick="this.select()" style="width:100%;height:60px;background:#111;color:#C9A84C;border:1px solid #333;padding:12px;font-family:monospace;font-size:13px">${tokens.refresh_token}</textarea>
  ` : `<p style="color:#e55">Pas de refresh token (déjà autorisé avant). Révoquer l'accès dans les paramètres Google puis réessayer.</p>`;

  const locationSection = locationName ? `
    <h3 style="color:#4a4;margin-top:24px">GOOGLE_LOCATION_NAME trouvé :</h3>
    <textarea readonly onclick="this.select()" style="width:100%;height:40px;background:#111;color:#4a4;border:1px solid #333;padding:12px;font-family:monospace;font-size:14px">${locationName}</textarea>
  ` : "";

  return html(`
    <h2 style="color:#C9A84C">Autorisation Google réussie !</h2>

    ${refreshSection}

    ${locationSection}

    <h3 style="color:#fff;margin-top:24px">Comptes :</h3>
    <pre style="background:#111;padding:16px;color:#ccc;white-space:pre-wrap;max-height:300px;overflow:auto">${accountsResult}</pre>

    <h3 style="color:#fff;margin-top:24px">Locations :</h3>
    <pre style="background:#111;padding:16px;color:#ccc;white-space:pre-wrap;max-height:300px;overflow:auto">${locationsResult || "Aucune (voir méthode manuelle ci-dessous)"}</pre>

    <hr style="border-color:#333;margin:32px 0">
    <h3 style="color:#fff">Méthode manuelle (si les APIs bloquent) :</h3>
    <ol style="color:#ccc">
      <li>Va sur <a href="https://business.google.com" style="color:#C9A84C" target="_blank">business.google.com</a></li>
      <li>Clique sur ton établissement</li>
      <li>L'URL contient un numéro, ex: <code style="color:#C9A84C">business.google.com/n/XXXXXXXXX/dashboard</code></li>
      <li>Copie ce numéro et envoie-le moi</li>
    </ol>
  `);
}
