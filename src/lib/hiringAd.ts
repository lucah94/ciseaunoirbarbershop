/**
 * Contenu de la pub d'embauche « Perle Rare » (août 2026).
 *
 * Séparé du code d'appel API pour que le texte puisse être relu, corrigé ou régénéré
 * sans toucher à la mécanique Meta.
 */

/** Visuel fourni par Melynda, servi depuis le site (public/pub/). */
export const HIRING_AD_IMAGE_PATH = "/pub/perle-rare.jpg";

export function hiringAdImageUrl(origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.ciseaunoirbarbershop.com";
  return `${base.replace(/\/$/, "")}${HIRING_AD_IMAGE_PATH}`;
}

export const HIRING_AD = {
  campaignName: "Ciseau Noir — Perle Rare (embauche)",
  dailyBudgetCad: 15,
  durationDays: 10,
  // Texte COURT — l'affiche elle-même contient déjà tous les détails (exigences,
  // avantages, chats, coordonnées). Le texte au-dessus ne doit pas répéter l'image,
  // juste donner envie de la lire et corriger ce que l'affiche ne dit pas (le civique).
  message: `On cherche notre perle rare ✂️

Le Ciseau Noir s'installe bientôt au 2275 Avenue Royale (Beauport) — un local remis au goût du jour, même équipe, même passion.

Toutes les infos sur l'affiche 👇 (oui, les chats font partie du deal 🐈‍⬛)

Ça te parle? Écris-nous en privé!`,
} as const;

/**
 * Mots-clés qui trahissent une candidature plutôt qu'une demande de rendez-vous.
 * Sert au bot Messenger : une candidate ne doit JAMAIS se faire proposer une coupe.
 */
export const HIRING_INTENT_KEYWORDS = [
  "perle rare",
  "offre d'emploi",
  "offre demploi",
  "poste",
  "embauche",
  "engagez",
  "engager",
  "recrutement",
  "recrute",
  "candidature",
  "postuler",
  "cv",
  "curriculum",
  "travailler avec vous",
  "travailler pour vous",
  "job",
  "emploi",
  "hiring",
  "barbiere cherche",
  "cherche un emploi",
  "je suis barbier",
  "je suis barbiere",
  "je suis coiffeuse",
  "je suis coiffeur",
] as const;

/** Détecte une candidature dans un message Messenger (accents et casse ignorés). */
export function looksLikeJobApplication(text: string): boolean {
  const norm = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return HIRING_INTENT_KEYWORDS.some((k) => norm.includes(k));
}
