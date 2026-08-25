import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setCampaignStatus, listCampaigns, isMetaAdsError } from "@/lib/metaAds";
import { deleteCampaign } from "@/lib/metaAdsCreate";
import { notifyAdStatusChange } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Pause / relance / suppression d'une campagne Meta existante.
 *
 * "delete" n'est permis QUE sur une campagne jamais activée (encore PAUSED) — sert à
 * nettoyer une proposition jamais approuvée (ex: remplacée par une meilleure version),
 * jamais à retirer une pub qui roule déjà. Chaque action est notifiée sur Telegram —
 * jamais de changement silencieux.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { campaignId, action } = await req.json().catch(() => ({}));

  if (action !== "pause" && action !== "activate" && action !== "delete") {
    return NextResponse.json({ error: "action doit être 'pause', 'activate' ou 'delete'" }, { status: 400 });
  }
  if (typeof campaignId !== "string" || !/^\d+$/.test(campaignId)) {
    return NextResponse.json({ error: "campaignId manquant ou invalide" }, { status: 400 });
  }

  if (action === "delete") {
    const campaigns = await listCampaigns();
    const c = !isMetaAdsError(campaigns) ? campaigns.find((x) => x.id === campaignId) : undefined;
    if (c && c.effectiveStatus === "ACTIVE") {
      return NextResponse.json({ error: "Cette campagne est ACTIVE — utilise 'pause' d'abord, pas 'delete'." }, { status: 400 });
    }
    const del = await deleteCampaign(campaignId);
    if (isMetaAdsError(del)) return NextResponse.json({ error: del.error }, { status: 502 });
    await notifyAdStatusChange(`🗑️ Proposition de pub supprimée (jamais approuvée) : « ${c?.name || campaignId} »`).catch(() => {});
    return NextResponse.json({ ok: true, campaignId, status: "DELETED" });
  }

  const status = action === "pause" ? "PAUSED" : "ACTIVE";
  const result = await setCampaignStatus(campaignId, status);

  if (isMetaAdsError(result)) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Retrouve le nom pour une notification lisible (sans bloquer si ça échoue).
  let name = campaignId;
  const campaigns = await listCampaigns();
  if (!isMetaAdsError(campaigns)) {
    name = campaigns.find((c) => c.id === campaignId)?.name || campaignId;
  }

  await notifyAdStatusChange(
    action === "pause"
      ? `⏸️ Pub Facebook mise sur PAUSE : « ${name} »\nLa dépense est arrêtée.`
      : `▶️ Pub Facebook RELANCÉE : « ${name} »\nLa dépense reprend.`
  ).catch(() => {});

  return NextResponse.json({ ok: true, campaignId, status, name });
}
