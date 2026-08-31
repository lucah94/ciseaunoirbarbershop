import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Diagnostic JSON (pas HTML) pour trouver le vrai identifiant de fiche Google Business —
 * GOOGLE_LOCATION_NAME s'est avéré contenir juste un retour à la ligne, pas un vrai ID.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.json({ error: "token exchange échoué", detail: tokenData }, { status: 502 });
    }
    const accessToken = tokenData.access_token;

    // v4 (pas les APIs plus récentes "split") — c'est la seule famille pour laquelle
    // le scope OAuth existant a été accordé (les avis/posts l'utilisent déjà avec succès).
    const acctRes = await fetch("https://mybusiness.googleapis.com/v4/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const acctData = await acctRes.json();
    if (!acctRes.ok) return NextResponse.json({ error: "liste comptes échouée", detail: acctData }, { status: 502 });

    const accountName = acctData.accounts?.[0]?.name;
    if (!accountName) return NextResponse.json({ error: "aucun compte trouvé", accounts: acctData });

    const locRes = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/locations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const locData = await locRes.json();

    return NextResponse.json({
      currentEnvValue: JSON.stringify(process.env.GOOGLE_LOCATION_NAME || ""),
      account: accountName,
      locations: locData,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 500 });
  }
}
