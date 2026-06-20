/**
 * Telegram Post Studio — lib/posts.ts
 * Génération, publication et suppression de posts Facebook pour Ciseau Noir.
 */

import { generateText, MODELS } from "@/lib/ai";

const FB_PAGE_ID = "577401682130596";

// ── Prompts par type de contenu ───────────────────────────────────────────────

const KIND_PROMPTS: Record<string, string> = {
  tip: `Rédige un post Facebook qui partage UN conseil concret de coiffure ou de soin de barbe, utile et facile à appliquer.
Accroche d'ouverture qui pique la curiosité ("Tu fais peut-être cette erreur…", "Le secret d'une barbe nette ?"), puis le truc pro, puis l'idée qu'en salon Melynda ou Stéphanie peaufinent ça encore mieux.
2-4 phrases. Termine par une invitation douce à réserver sur ciseaunoirbarbershop.com/booking.`,

  service_highlight: `Rédige un post Facebook qui met en valeur UN service de Ciseau Noir Barbershop avec une accroche qui arrête le scroll.
Services et prix RÉELS seulement : Coupe + Lavage 35$, Coupe + Barbe à la lame 50$, Coupe + Barbe Shaver 45$, Service Premium (VIP) 75$, Rasage/Barbe 25$, Enfant 12 ans et moins 30$.
N'invente AUCUN prix ni rabais. Décris le bénéfice ressenti (look soigné, confiance, moment pour soi), pas juste l'acte.
Donne une raison de venir maintenant et un appel à l'action clair vers ciseaunoirbarbershop.com/booking. 2-4 phrases.`,

  product: `Rédige un post Facebook sur les produits de soin disponibles EN SALON chez Ciseau Noir (pommades, huiles à barbe, soins capillaires — reste général, n'invente aucun produit précis).
Accroche concrète, bénéfice clair (tenue, look qui dure entre deux visites), invitation à venir les essayer/voir en salon. N'invente AUCUN prix.
2-3 phrases, ton premium et chaleureux.`,

  client_appreciation: `Rédige un post Facebook de remerciement sincère envers les clients fidèles de Ciseau Noir Barbershop.
Accroche humaine et chaleureuse, gratitude authentique (pas de cliché corporatif), invite à laisser un avis Google et à revenir prendre rendez-vous.
2-3 phrases. Termine par un clin d'œil à réserver sur ciseaunoirbarbershop.com/booking.`,

  news_seasonal: `Rédige un post Facebook qui surfe sur la saison ou un moment de l'année pour donner envie de prendre rendez-vous.
Accroche saisonnière (rentrée, été, look des Fêtes, photos, mariage, entretien régulier), raison concrète de venir maintenant pour un look soigné.
Reste ancré dans la réalité du salon (375 Boul. des Chutes, Beauport, ville de Québec, ouvert mar-sam). N'invente rien de précis.
2-4 phrases. Appel à l'action clair vers ciseaunoirbarbershop.com/booking.`,

  promotion: `Rédige un post Facebook promotionnel pour Ciseau Noir Barbershop avec une accroche forte qui arrête le scroll.
La SEULE offre permise : Service Premium (VIP) normalement 75$, EN PROMO à 65$.
N'invente AUCUN autre rabais, cadeau, gratuité, concours ni prix. Ne dis JAMAIS que le VIP est à 50$.
Mets en avant le bénéfice (l'expérience VIP : soin complet, moment de détente, look impeccable) et une raison d'en profiter maintenant.
Appel à l'action clair vers ciseaunoirbarbershop.com/booking. 2-4 phrases.`,

  custom: `Rédige un post Facebook créatif et engageant pour Ciseau Noir Barbershop, avec une accroche qui arrête le scroll.
Services et prix RÉELS : Coupe + Lavage 35$, Coupe + Barbe à la lame 50$, Coupe + Barbe Shaver 45$, Service Premium (VIP) 75$, Rasage/Barbe 25$, Enfant 12 ans et moins 30$.
N'invente AUCUN rabais, cadeau ni prix fictif. Mise sur le bénéfice concret et une raison de venir maintenant.
Appel à l'action clair vers ciseaunoirbarbershop.com/booking. 2-4 phrases.`,
};

const SALON_CONTEXT = `

Salon : Ciseau Noir Barbershop, barbershop premium à Beauport, ville de Québec.
Adresse : 375 Boul. des Chutes, Beauport, ville de Québec
Téléphone : (418) 665-5703
Réservation en ligne : ciseaunoirbarbershop.com/booking
Lien d'avis Google (à mettre CLIQUABLE quand le post invite à laisser un avis) : https://g.page/r/CQluoL7lA0BBEAE/review

STYLE (calibre des meilleurs barbershops) :
- Si le post demande un avis Google, inclus le lien direct cliquable https://g.page/r/CQluoL7lA0BBEAE/review (pas juste « sur Google »).
- Une accroche forte (hook) en ouverture qui arrête le scroll.
- Un bénéfice concret + une raison de venir MAINTENANT (saisonnalité, look soigné, confiance en soi).
- UN seul appel à l'action clair vers la réservation en ligne (ciseaunoirbarbershop.com/booking).
- Angle local assumé : Beauport, ville de Québec.
- Ton premium, chaleureux, québécois naturel. Varie les formulations à chaque fois, jamais robotique ni cliché.
- Maximum 2-3 hashtags pertinents (pas de mur de hashtags), 1-2 emojis bien placés.
- Français québécois soigné.
Génère uniquement le texte du post, sans guillemets ni introduction.`;

// ── generatePost ──────────────────────────────────────────────────────────────

export async function generatePost(kind: string, instructions?: string): Promise<string> {
  const basePrompt = KIND_PROMPTS[kind] || KIND_PROMPTS.custom;
  const instructionClause = instructions
    ? `\n\nInstructions spécifiques : ${instructions}`
    : "";

  const prompt = `${basePrompt}${instructionClause}${SALON_CONTEXT}`;

  const text = await generateText({
    model: MODELS.SMART,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return (
    text ||
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
