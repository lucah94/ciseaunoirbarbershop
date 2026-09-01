import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * NEXT_PUBLIC_SITE_URL n'est pas un secret (préfixe public par convention Next.js) —
 * sert à vérifier que le lien envoyé par SMS a bien un "https://" devant, sinon
 * certains téléphones ne le rendent pas cliquable dans le message.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const raw = process.env.NEXT_PUBLIC_SITE_URL || "(non défini — fallback https://ciseaunoirbarbershop.com utilisé)";
  const resolved = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
  const exampleLink = `${resolved}/booking/rdv/EXEMPLE-ID`;

  // Vérif rapide d'autres variables publiques (non secrètes) pour le même bug —
  // trouvé deux fois déjà (GOOGLE_LOCATION_NAME, NEXT_PUBLIC_SITE_URL), donc on regarde
  // s'il y en a d'autres avant que ça morde ailleurs.
  const otherVars = ["NEXT_PUBLIC_GA_ID", "FACEBOOK_PAGE_ID", "FACEBOOK_APP_ID", "TWILIO_PHONE_NUMBER"];
  const otherChecks: Record<string, { valeur: string; propre: boolean }> = {};
  for (const key of otherVars) {
    const v = process.env[key];
    if (v !== undefined) otherChecks[key] = { valeur: JSON.stringify(v), propre: v === v.trim() };
  }

  return NextResponse.json({
    valeurBrute: raw,
    valeurUtilisee: resolved,
    aHttps: resolved.startsWith("https://") || resolved.startsWith("http://"),
    lienExemple: exampleLink,
    autresVariables: otherChecks,
  });
}
