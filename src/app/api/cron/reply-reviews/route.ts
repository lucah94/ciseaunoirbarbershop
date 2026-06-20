import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleReviews, replyToGoogleReview } from "@/lib/google";
import { aiClient as anthropic, MODELS } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function generateReply(
  reviewerName: string,
  rating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE",
  comment: string | undefined
): Promise<string> {
  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const stars = ratingMap[rating];

  const tone = stars >= 4
    ? "chaleureux et reconnaissant. Remercie le client par son prénom. Invite à revenir."
    : stars === 3
    ? "professionnel et attentionné. Remercie pour le feedback, invite à contacter Melynda directement pour améliorer l'expérience."
    : "empathique, professionnel, jamais défensif. Présente des excuses sincères, invite à contacter Melynda au (418) 665-5703 pour résoudre la situation.";

  const prompt = `Tu es Melynda, propriétaire et barbière de Ciseau Noir Barbershop — un barbershop haut de gamme à Beauport (Québec). Tu réponds personnellement aux avis Google de tes clients.

Avis de ${reviewerName} (${stars}/5 étoiles):
"${comment || '(aucun commentaire, juste une note)'}"

Écris une réponse ${tone}

Ce qui fait une BELLE réponse:
- Reprends un détail concret de leur avis (le service, le barbier, l'ambiance) — jamais une réponse passe-partout
- Ton authentique et chaleureux, comme Melynda parlerait vraiment — français québécois naturel, pas corporatif
- Varie tes formulations, évite les clichés ("Merci pour votre avis", "Au plaisir de vous revoir") et le ton robot
- Classe et soignée : cette réponse représente le salon publiquement

Règles:
- Maximum 3 phrases
- Adresse la personne par son prénom
- Signe juste "Melynda ✂️" à la fin
- Pas de guillemets autour de la réponse, pas de hashtags, pas de promotion
- Réponds uniquement le texte de la réponse, rien d'autre`;

  const response = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  return text?.trim() || `Merci pour votre avis ! N'hésite pas à revenir nous voir au salon.\nMelynda ✂️`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!process.env.GOOGLE_LOCATION_NAME) {
    return NextResponse.json({ ok: false, reason: "GOOGLE_LOCATION_NAME non configuré" });
  }

  const { reviews, error } = await fetchGoogleReviews();
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });

  const results: Array<{ reviewer: string; rating: string; replied: boolean; error?: string }> = [];

  for (const review of reviews) {
    if (review.reviewReply) continue;

    try {
      const reply = await generateReply(review.reviewer.displayName, review.starRating, review.comment);
      const reviewName = `accounts/-/locations/-/reviews/${review.reviewId}`;
      const fullName = process.env.GOOGLE_LOCATION_NAME + `/reviews/${review.reviewId}`;
      const result = await replyToGoogleReview(fullName, reply);
      results.push({
        reviewer: review.reviewer.displayName,
        rating: review.starRating,
        replied: result.success,
        error: result.error,
      });
    } catch (e) {
      results.push({
        reviewer: review.reviewer.displayName,
        rating: review.starRating,
        replied: false,
        error: String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total_reviews: reviews.length,
    new_replies: results.length,
    results,
  });
}
