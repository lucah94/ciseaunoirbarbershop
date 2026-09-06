import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getFacebookToken } from "@/lib/fbToken";

export const dynamic = "force-dynamic";

/**
 * Deux personnes réelles (non-testeurs de l'app) ont essayé d'écrire à la page et ont
 * vu "Envoi impossible" — CÔTÉ CLIENT, avant même que notre webhook reçoive quoi que ce
 * soit (aucune ligne créée dans messenger_conversations pour elles). Ça pointe vers une
 * restriction au niveau de la PAGE elle-même (pas notre code), pas visible depuis nos
 * logs habituels. Ce diagnostic va chercher tout ce que Meta expose sur l'état de la page.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = await getFacebookToken();
  const pageId = process.env.FACEBOOK_PAGE_ID || "577401682130596";

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,is_published,is_permanently_closed,verification_status,is_messenger_platform_bot,connected_instagram_account&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const data = await res.json().catch(() => ({}));

  return NextResponse.json({ pageInfo: data });
}
