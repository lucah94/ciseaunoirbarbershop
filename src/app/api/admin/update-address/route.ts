import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateGoogleBusinessAddress } from "@/lib/google";
import { getFacebookToken } from "@/lib/fbToken";

export const dynamic = "force-dynamic";

/**
 * Met à jour l'adresse du commerce PARTOUT où Meta/Google la stockent eux-mêmes
 * (le code du site est déjà à jour — ceci touche les fiches externes) :
 * - Page Facebook (champ location)
 * - Fiche Google Business Profile (storefrontAddress)
 *
 * Déclenchement manuel (bouton admin), pas automatique : un déménagement, ça
 * n'arrive pas souvent, et une erreur ici est visible publiquement (Google Maps, FB).
 */
const NEW_ADDRESS = {
  street: "2275 Avenue Royale",
  city: "Québec",
  province: "QC",
  postalCode: "G1C 1P5",
};

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const results: Record<string, { ok: boolean; error?: string }> = {};

  // Facebook — PATCH direct sur la Page via le token système.
  try {
    const token = await getFacebookToken();
    const pageId = process.env.FACEBOOK_PAGE_ID || "577401682130596";
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        location: {
          street: NEW_ADDRESS.street,
          city: NEW_ADDRESS.city,
          state: NEW_ADDRESS.province,
          zip: NEW_ADDRESS.postalCode,
          country: "Canada",
        },
      }),
    });
    const data = await res.json();
    results.facebook = res.ok && data.success !== false
      ? { ok: true }
      : { ok: false, error: JSON.stringify(data).slice(0, 300) };
  } catch (e) {
    results.facebook = { ok: false, error: e instanceof Error ? e.message : "erreur" };
  }

  // Google Business Profile
  const g = await updateGoogleBusinessAddress({
    addressLines: [NEW_ADDRESS.street],
    locality: NEW_ADDRESS.city,
    postalCode: NEW_ADDRESS.postalCode,
    administrativeArea: NEW_ADDRESS.province,
  });
  results.google = g.success ? { ok: true } : { ok: false, error: g.error };

  const allOk = Object.values(results).every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
