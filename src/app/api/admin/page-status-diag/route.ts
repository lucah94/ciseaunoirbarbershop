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

  // L'ABONNEMENT de l'app aux webhooks de la page : c'est LUI qui fait que Meta nous
  // livre (ou pas) les messages. Il saute silencieusement quand le jeton est regenere
  // ou que l'app change de mode — la page reste "en ligne", le bot reste "connecte",
  // et pourtant plus rien n'arrive. Aucun log ne le montre : il faut le demander a Meta.
  const subRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const subs = await subRes.json().catch(() => ({}));
  const apps = (subs.data as { name?: string; subscribed_fields?: string[] }[] | undefined) || [];
  const champs = apps.flatMap((a) => a.subscribed_fields || []);
  const recoitLesMessages = champs.includes("messages");

  return NextResponse.json({
    pageInfo: data,
    abonnementWebhook: {
      ok: recoitLesMessages,
      verdict: recoitLesMessages
        ? "La page est bien abonnee : Meta nous livre les messages."
        : "LA PAGE N'EST PLUS ABONNEE au champ « messages » — c'est pour ca que le bot ne recoit plus rien.",
      apps,
      erreur: subs.error ?? null,
    },
  });
}

/**
 * Ré-abonne la page à nos webhooks (messages, postbacks, optins, livraisons).
 * C'est le geste qui répare le cas « la page marche, le jeton marche, mais aucun
 * message n'arrive ».
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = await getFacebookToken();
  const pageId = process.env.FACEBOOK_PAGE_ID || "577401682130596";

  const fields = [
    "messages",
    "messaging_postbacks",
    "messaging_optins",
    "message_deliveries",
    "message_reads",
    "feed",
  ].join(",");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribed_fields: fields, access_token: token }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const data = await res.json().catch(() => ({}));

  // On relit tout de suite pour prouver que c'est pris (et pas juste "success: true").
  const verifRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const verif = await verifRes.json().catch(() => ({}));
  const champs = ((verif.data as { subscribed_fields?: string[] }[] | undefined) || []).flatMap((a) => a.subscribed_fields || []);

  return NextResponse.json({
    ok: res.ok && champs.includes("messages"),
    reponseMeta: data,
    champsApres: champs,
  }, { status: res.ok ? 200 : 502 });
}
