import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setCampaignStatus, listCampaigns, isMetaAdsError } from "@/lib/metaAds";
import { notifyAdStatusChange } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Pause / relance d'une campagne Meta existante.
 *
 * Volontairement limité à ces deux actions : pas de création, pas de changement
 * de budget. Mettre sur pause ne peut que RÉDUIRE la dépense, et relancer ne fait
 * que remettre en marche une campagne dont le budget a déjà été approuvé.
 * Chaque action est notifiée sur Telegram — jamais de changement silencieux.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { campaignId, action } = await req.json().catch(() => ({}));

  if (action !== "pause" && action !== "activate") {
    return NextResponse.json({ error: "action doit être 'pause' ou 'activate'" }, { status: 400 });
  }
  if (typeof campaignId !== "string" || !/^\d+$/.test(campaignId)) {
    return NextResponse.json({ error: "campaignId manquant ou invalide" }, { status: 400 });
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
