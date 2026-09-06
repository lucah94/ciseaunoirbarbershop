import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Liste TOUTES les pages "Ciseau Noir" accessibles — pour vérifier s'il existe une
 * page dupliquée/ancienne à laquelle des vrais clients écrivent par erreur (au lieu de
 * la page qu'on gère réellement, FACEBOOK_PAGE_ID). Si un client tombe sur la mauvaise
 * page, notre bot ne la voit jamais et ne peut évidemment pas répondre.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const sut = process.env.FACEBOOK_SYSTEM_USER_TOKEN || "";
  const ourPageId = process.env.FACEBOOK_PAGE_ID || "577401682130596";

  // Pages que le token système gère directement.
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,is_published,link&access_token=${encodeURIComponent(sut)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const managedPages = await res.json().catch(() => ({}));

  // Recherche publique par nom — trouve une page "Ciseau Noir" qu'on ne gère PAS.
  const searchRes = await fetch(
    `https://graph.facebook.com/v19.0/pages/search?q=Ciseau%20Noir&fields=id,name,is_published,link,location&access_token=${encodeURIComponent(sut)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const searchResult = await searchRes.json().catch(() => ({}));

  return NextResponse.json({ ourPageId, managedPages, publicSearch: searchResult });
}
