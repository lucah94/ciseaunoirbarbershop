import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createEmploymentAd } from "@/lib/metaAdsCreate";
import { isMetaAdsError } from "@/lib/metaAds";
import { proposeAdOnTelegram } from "@/lib/telegram";
import { HIRING_AD, hiringAdImageUrl } from "@/lib/hiringAd";

export const dynamic = "force-dynamic";

/**
 * Prépare la pub d'embauche « Perle Rare » et l'envoie sur Telegram pour approbation.
 *
 * La pub est créée SUR PAUSE chez Meta : elle existe, elle est prête, mais elle ne
 * se diffuse pas et ne dépense rien tant que personne n'a tapé « Approuver ».
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const dailyBudgetCad = Number(body.dailyBudgetCad) || HIRING_AD.dailyBudgetCad;
  const durationDays = Number(body.durationDays) || HIRING_AD.durationDays;
  const message = typeof body.message === "string" && body.message.trim()
    ? body.message.trim()
    : HIRING_AD.message;

  const imageUrl = hiringAdImageUrl(req.nextUrl.origin);

  const created = await createEmploymentAd({
    campaignName: HIRING_AD.campaignName,
    message,
    imageUrl,
    dailyBudgetCad,
    durationDays,
  });

  if (isMetaAdsError(created)) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  // On garde les identifiants Meta en base : le callback Telegram ne transporte
  // qu'une courte clé (limite de 64 octets sur callback_data).
  const { data: row, error } = await supabaseAdmin
    .from("pending_posts")
    .insert({
      kind: "pub-meta",
      status: "pending",
      content: JSON.stringify({
        campaignId: created.campaignId,
        adSetId: created.adSetId,
        adId: created.adId,
        message,
        imageUrl,
        dailyBudget: created.dailyBudget,
        durationDays: created.durationDays,
        maxTotalSpend: created.maxTotalSpend,
      }),
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: `Pub créée chez Meta (campagne ${created.campaignId}) mais impossible de l'enregistrer : ${error?.message}` },
      { status: 500 }
    );
  }

  const sent = await proposeAdOnTelegram({
    id: row.id as string,
    imageUrl,
    message,
    dailyBudget: created.dailyBudget,
    durationDays: created.durationDays,
    maxTotalSpend: created.maxTotalSpend,
  });

  return NextResponse.json({
    ok: true,
    proposed: sent,
    pendingId: row.id,
    ...created,
  });
}
