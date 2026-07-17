import { NextRequest, NextResponse } from "next/server";
import { getPromoOfTheMonth } from "@/lib/promo-rotator";
import { generateText, MODELS } from "@/lib/ai";
import { isComposioConfigured, composioFacebookPost, composioInstagramPost } from "@/lib/composio";
import { postToGoogleMyBusiness } from "@/lib/google";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const promo = getPromoOfTheMonth();

  // 1. Récupérer 1 photo aléatoire du portfolio pour le post (si dispo)
  const { data: photos } = await supabaseAdmin
    .from("portfolio")
    .select("url, caption, tags")
    .order("created_at", { ascending: false })
    .limit(20);

  const photo = photos && photos.length > 0
    ? photos[Math.floor(Math.random() * photos.length)]
    : null;

  // 2. Générer le contenu enrichi via AI
  const prompt = `Tu es le community manager d'un barbershop premium : Ciseau Noir Barbershop, à Beauport, ville de Québec.

Promo du mois: ${promo.title}
Base: ${promo.body}
${photo?.caption ? `Photo associée: ${photo.caption}` : ""}

Rédige un post Facebook+Instagram au calibre des meilleurs barbershops, en français québécois naturel:
- Ouvre par une accroche forte (hook) qui arrête le scroll.
- Donne un bénéfice concret + une raison de venir MAINTENANT (saisonnalité, look soigné, confiance en soi).
- Assume l'angle local : Beauport, ville de Québec.
- Garde le ton chaleureux et premium de Melynda. Varie les formulations, jamais robotique ni cliché.
- Maximum 4 phrases.
- 1-2 emojis bien placés, et au plus 2-3 hashtags pertinents parmi : ${promo.hashtags.join(" ")} #Beauport #VilleDeQuebec (pas de mur de hashtags).
- Termine par UN appel à l'action clair vers la réservation: "${promo.cta}"
- N'inclus PAS d'URL (sera ajoutée auto)`;

  const aiText = await generateText({
    model: MODELS.FREE,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const finalContent = `${aiText}\n\n📍 ciseaunoirbarbershop.com/booking`;

  const results: Record<string, unknown> = {
    promo_key: promo.key,
    photo_used: photo?.url || null,
    content_preview: finalContent.slice(0, 100),
  };

  // 3. Poster sur Facebook + Instagram via Composio
  if (isComposioConfigured()) {
    try {
      const fb = await composioFacebookPost(finalContent);
      results.facebook = fb;
    } catch (e) {
      results.facebook_error = String(e);
    }
    try {
      const ig = await composioInstagramPost(finalContent, photo?.url);
      results.instagram = ig;
    } catch (e) {
      results.instagram_error = String(e);
    }
  }

  // 4. Poster sur Google My Business
  if (process.env.GOOGLE_LOCATION_NAME) {
    try {
      const gmb = await postToGoogleMyBusiness(finalContent);
      results.gmb = gmb;
    } catch (e) {
      results.gmb_error = String(e);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
