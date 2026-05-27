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

  const prompt = `Tu es Melynda, propriétaire et barbière de Ciseau Noir Barbershop à Québec.
Réponds à cet avis Google de manière ${tone}

Avis de ${reviewerName} (${stars}/5 étoiles):
"${comment || '(pas de commentaire)'}"

Règles strictes:
- Maximum 3 phrases
- Français québécois naturel, pas trop formel
- Signe juste "Melynda ✂️"
- N'inclus pas de guillemets autour de la réponse
- Ne mentionne pas de promotion
- Reste authentique et personnel`;

  const response = await anthropic.messages.create({
    model: MODELS.BALANCED,
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
