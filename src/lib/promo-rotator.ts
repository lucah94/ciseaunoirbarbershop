/**
 * Système de rotation automatique des promos.
 * 12 promos différentes — 1 par mois — pour éviter la lassitude
 * et garder le contenu frais sur les réseaux sociaux.
 */

export type Promo = {
  key: string;
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
};

export const PROMO_ROTATION: Record<number, Promo> = {
  // Janvier — Nouvelle année
  1: {
    key: "nouvelle-annee",
    title: "Nouvelle année, nouveau style 💈",
    body: "Démarre 2026 avec une coupe fraîche chez Ciseau Noir Barbershop. Réserve ton créneau de janvier — Melynda t'attend.",
    cta: "Réserver maintenant",
    hashtags: ["#NouvelleAnnee", "#BarbershopQuebec", "#CiseauNoir"],
  },
  // Février — Saint-Valentin
  2: {
    key: "valentin",
    title: "Sois irrésistible pour la St-Valentin ❤️",
    body: "Réserve ta coupe avant le 14 février et fais sensation. Coupe + barbe + lavage = expérience complète.",
    cta: "Je réserve",
    hashtags: ["#SaintValentin", "#StyleHomme", "#Quebec"],
  },
  // Mars — Printemps
  3: {
    key: "printemps",
    title: "Le printemps arrive — rafraîchis ton look 🌸",
    body: "Après l'hiver, ta barbe et tes cheveux ont besoin d'amour. Service premium = coupe + rasage lame + serviette chaude.",
    cta: "Voir les services",
    hashtags: ["#Printemps2026", "#Barbier", "#Beauport"],
  },
  // Avril — Pâques
  4: {
    key: "paques",
    title: "Pâques en beauté 🐰",
    body: "Tes parents arrivent pour le souper? Sois au top. Réserve avant la fin de la semaine.",
    cta: "Réserver",
    hashtags: ["#Paques", "#QuebecBarbershop", "#CiseauNoir"],
  },
  // Mai — Mai = mariages
  5: {
    key: "mariages",
    title: "Saison des mariages — coupe parfaite 💍",
    body: "Témoin, marié, invité? Une coupe impeccable s'impose. Service Premium Mariage avec rasage lame.",
    cta: "Réserver mariage",
    hashtags: ["#Mariage2026", "#Marie", "#Temoin"],
  },
  // Juin — Fête des Pères + été
  6: {
    key: "fete-peres",
    title: "Bonne fête papa 👨‍👦 — Offre une carte-cadeau",
    body: "Pas d'idée pour la fête des Pères? Carte-cadeau Ciseau Noir Barbershop = cadeau parfait. De 30$ à 100$.",
    cta: "Offrir une carte",
    hashtags: ["#FetePeres", "#CadeauPapa", "#CarteCadeau"],
  },
  // Juillet — Été pic
  7: {
    key: "ete",
    title: "Coupe d'été légère ☀️",
    body: "Chaleur intense? On te taille du léger qui respire. Coupe + lavage frais = la solution.",
    cta: "Réserve l'été",
    hashtags: ["#Ete2026", "#CoupeEte", "#Quebec"],
  },
  // Août — Vacances
  8: {
    key: "rentree",
    title: "La rentrée approche — sois prêt 🍂",
    body: "Retour au boulot, à l'école, photos de famille. Une coupe nette change tout. Réserve avant septembre.",
    cta: "Réserver rentrée",
    hashtags: ["#Rentree", "#BackToWork", "#Beauport"],
  },
  // Septembre — Rentrée
  9: {
    key: "automne",
    title: "Automne — barbe et look saisonnier 🍁",
    body: "L'automne, c'est la saison des barbes plus longues. On les sculpte, on les entretient, on les met en valeur.",
    cta: "Tailler ma barbe",
    hashtags: ["#Automne", "#Barbe", "#Hommes"],
  },
  // Octobre — Halloween
  10: {
    key: "halloween",
    title: "Costume Halloween? Look à finaliser 👻",
    body: "Une coupe nette ou une moustache sculptée peut faire LE costume. Viens en discuter avec Melynda.",
    cta: "Booker un slot",
    hashtags: ["#Halloween2026", "#Costume", "#Barbier"],
  },
  // Novembre — Movember
  11: {
    key: "movember",
    title: "Movember 🥸 — taille ta moustache",
    body: "Tu participes au Movember? On te sculpte une moustache mémorable. Tous les styles, du chevalier au cowboy.",
    cta: "Movember chez nous",
    hashtags: ["#Movember", "#Moustache", "#SantéHomme"],
  },
  // Décembre — Fêtes
  12: {
    key: "fetes",
    title: "Fêtes de fin d'année — sois au top 🎄",
    body: "Photos de famille, partys, rencontres. Réserve ta coupe avant la fin décembre. Cartes-cadeaux disponibles!",
    cta: "Réserver pour les fêtes",
    hashtags: ["#Noel2026", "#FetesFin", "#CarteCadeau"],
  },
};

export function getPromoOfTheMonth(): Promo {
  const now = new Date();
  return PROMO_ROTATION[now.getMonth() + 1] || PROMO_ROTATION[1];
}
