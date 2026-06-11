/**
 * Telegram Post Studio — lib/posts.ts
 * Génération, publication et suppression de posts Facebook pour Ciseau Noir.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";

const FB_PAGE_ID = "577401682130596";

// ── Prompts par type de contenu ───────────────────────────────────────────────

const KIND_PROMPTS: Record<string, string> = {
  tip: `Génère un conseil de coiffure ou de soin de barbe utile pour les clients de Ciseau Noir Barbershop (Québec).
Partage un truc pro. Mentionne que Melynda ou Stéphanie peut aider en salon.
Français québécois, emojis, 2-4 phrases. Génère uniquement le texte du post, sans guillemets.`,

  service_highlight: `Génère une publication Facebook qui met en valeur UN service de Ciseau Noir Barbershop.
Services et prix RÉELS seulement : Coupe + Lavage 35$, Coupe + Barbe + Lavage 50$, Service Premium (VIP) 75$, Rasage/Barbe 25$, Étudiant/Enfant 30$.
N'invente AUCUN prix ni rabais. Incite à réserver sur ciseaunoirbarbershop.com/booking.
Français québécois, emojis, 2-4 phrases.`,

  product: `Génère une publication Facebook sur les produits de soin disponibles EN SALON chez Ciseau Noir (pommades, huiles à barbe, soins capillaires — reste général, n'invente aucun produit précis).
Invite à venir voir en salon. N'invente AUCUN prix.
Français québécois, emojis, 2-3 phrases.`,

  client_appreciation: `Génère un message de remerciement chaleureux envers les clients fidèles de Ciseau Noir Barbershop.
Exprime de la gratitude, invite à laisser un avis Google, encourage à revenir.
Français québécois, emojis, 2-3 phrases.`,

  news_seasonal: `Génère une publication Facebook sur l'actualité saisonnière ou une nouveauté de Ciseau Noir Barbershop.
Reste ancré dans la réalité du salon (375 Boul. des Chutes, Québec, ouvert mar-sam). N'invente rien de précis.
Français québécois, emojis, 2-4 phrases.`,

  promotion: `Génère une publication Facebook promotionnelle pour Ciseau Noir Barbershop.
La SEULE offre permise : Service Premium (VIP) normalement 75$, EN PROMO à 65$.
N'invente AUCUN autre rabais, cadeau, gratuité, concours ni prix. Ne dis JAMAIS que le VIP est à 50$.
Incite à réserver sur ciseaunoirbarbershop.com/booking.
Français québécois, emojis, 2-4 phrases.`,

  custom: `Génère une publication Facebook créative et engageante pour Ciseau Noir Barbershop.
Services et prix RÉELS : Coupe + Lavage 35$, Coupe + Barbe + Lavage 50$, Service Premium (VIP) 75$, Rasage/Barbe 25$, Étudiant/Enfant 30$.
N'invente AUCUN rabais, cadeau ni prix fictif. Incite à réserver sur ciseaunoirbarbershop.com/booking.
Français québécois, emojis, 2-4 phrases.`,
};

const SALON_CONTEXT = `
Salon : Ciseau Noir Barbershop
Adresse : 375 Boul. des Chutes, Québec
Téléphone : (418) 665-5703
Réservation : ciseaunoirbarbershop.com/booking
Génère uniquement le texte du post, sans guillemets ni introduction.`;

// ── generatePost ──────────────────────────────────────────────────────────────

export async function generatePost(kind: string, instructions?: string): Promise<string> {
  const basePrompt = KIND_PROMPTS[kind] || KIND_PROMPTS.custom;
  const instructionClause = instructions
    ? `\n\nInstructions spécifiques : ${instructions}`
    : "";

  const prompt = `${basePrompt}${instructionClause}${SALON_CONTEXT}`;

  const response = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return (
    textBlock?.text?.trim() ||
    "✂️ Ciseau Noir Barbershop — votre barbier à Québec ! Réservez en ligne sur ciseaunoirbarbershop.com/booking ✨"
  );
}

// ── publishPostToFacebook ─────────────────────────────────────────────────────

export async function publishPostToFacebook(
  content: string
): Promise<{ id?: string; error?: string }> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return { error: "FACEBOOK_ACCESS_TOKEN manquant" };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, access_token: token }),
    });
    const data = (await res.json()) as { id?: string; error?: { message?: string } };
    if (data.error) return { error: data.error.message || "Erreur Facebook" };
    return { id: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur réseau Facebook" };
  }
}

// ── deleteFacebookPost ────────────────────────────────────────────────────────

export async function deleteFacebookPost(postId: string): Promise<boolean> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${postId}?access_token=${encodeURIComponent(token)}`,
      { method: "DELETE" }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
