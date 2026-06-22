// ─────────────────────────────────────────────────────────────────────────────
// LISTE CANONIQUE DES SERVICES PAR DÉFAUT (FALLBACK)
//
// Source de vérité unique pour la liste de secours des services/prix, utilisée
// PARTOUT où l'on a besoin d'afficher les services quand /api/services (table
// Supabase) échoue ou renvoie vide — pour ne JAMAIS casser le booking.
//
// AVANT : cette liste était copiée-collée dans ~5 fichiers. Changer un prix à un
// endroit sans l'autre désynchronisait l'affichage. Tout est maintenant ICI.
//
// La source de vérité RÉELLE en production reste la table Supabase `services`
// (gérée par Melynda). Ce fichier n'est que le filet de sécurité.
// ─────────────────────────────────────────────────────────────────────────────

// Forme canonique d'un service de secours : couvre tous les champs utilisés par
// les différents consommateurs (booking, accueil, page services, agenda admin).
export type FallbackService = {
  /** id local stable (slug). Sert d'identifiant côté booking. */
  id: string;
  /** Nom affiché = clé de correspondance avec la table Supabase `services`. */
  name: string;
  /** Prix en nombre (CAD), sans symbole. */
  price: number;
  /** Durée du RDV en minutes. */
  duration_min: number;
  /** Description courte affichée sous le nom. */
  description: string;
  /** Emoji/icône du service. */
  icon: string;
  /** Détails décoratifs (page /services) — pas en DB, par correspondance de nom. */
  includes: string[];
  /** Mis en avant ("Populaire") sur la page /services — décoratif. */
  featured?: boolean;
};

// LA liste canonique. Mêmes services, mêmes prix, même ordre qu'avant.
export const FALLBACK_SERVICES: FallbackService[] = [
  {
    id: "wash-cut",
    name: "Coupe + Lavage",
    price: 35,
    duration_min: 45,
    description: "Coupe classique avec shampoing",
    icon: "✂️",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Finition & coiffage"],
  },
  {
    id: "wash-cut-shave",
    name: "Coupe + Barbe à la lame",
    price: 50,
    duration_min: 60,
    description: "Coupe, rasage lame & serviette chaude",
    icon: "🪒",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude"],
  },
  {
    id: "cut-beard-shaver",
    name: "Coupe + Barbe Shaver",
    price: 45,
    duration_min: 45,
    description: "Coupe, barbe & rasage à la tondeuse (shaver)",
    icon: "🧔",
    includes: ["Coupe personnalisée", "Barbe taillée", "Rasage à la tondeuse (shaver)"],
  },
  {
    id: "premium",
    name: "Service Premium",
    price: 75,
    duration_min: 75,
    description: "Coupe, rasage, serviette chaude & exfoliant",
    icon: "👑",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude", "Exfoliant visage"],
    featured: true,
  },
  {
    id: "shave",
    name: "Rasage / Barbe",
    price: 25,
    duration_min: 30,
    description: "Rasage lame, barbe & tondeuse",
    icon: "🧔",
    includes: ["Rasage lame droite ou tondeuse", "Serviette chaude", "Finition barbe"],
  },
  {
    id: "child",
    name: "Enfant (12 ans et moins)",
    price: 30,
    duration_min: 30,
    description: "Coupe pour enfant de 12 ans et moins (preuve d'âge)",
    icon: "👦",
    includes: ["Coupe adaptée", "Finition soignée"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEURS — chaque consommateur a besoin d'une forme légèrement différente.
// Ces fonctions dérivent les formes spécifiques DE la liste canonique, sans
// dupliquer les données.
// ─────────────────────────────────────────────────────────────────────────────

// /api/services/route.ts : lignes type table `services` (price/duration nombres).
// NOTE : route.ts garde une description PLUS DÉTAILLÉE et un découpage différent
// du rasage (voir FALLBACK_API_SERVICES ci-dessous) — comportement préservé.
export type ApiServiceRow = {
  name: string;
  price: number;
  duration_min: number;
  description: string;
  icon: string;
};

// Forme utilisée côté booking (BookingClient) : prix "35$", durée "45 min".
export type BookingService = {
  id: string;
  name: string;
  price: string;
  duration: string;
  desc: string;
  icon: string;
};

export function toBookingServices(): BookingService[] {
  return FALLBACK_SERVICES.map(s => ({
    id: s.id,
    name: s.name,
    price: `${s.price}$`,
    duration: `${s.duration_min} min`,
    desc: s.description,
    icon: s.icon,
  }));
}

// Forme utilisée sur l'accueil (HomeContent) : { service, price "35$", desc }.
export type HomeService = { service: string; price: string; desc: string };

export function toHomeServices(): HomeService[] {
  return FALLBACK_SERVICES.map(s => ({
    service: s.name,
    price: `${s.price}$`,
    desc: s.description,
  }));
}

// Forme utilisée sur la page /services (cartes détaillées avec includes/featured).
export type ServiceCard = {
  name: string;
  price: string;
  duration: string;
  desc: string;
  includes: string[];
  featured?: boolean;
  icon: string;
};

export function toServiceCards(): ServiceCard[] {
  return FALLBACK_SERVICES.map(s => ({
    name: s.name,
    price: `${s.price}$`,
    duration: `${s.duration_min} min`,
    // Descriptions longues conservées par nom (décoratives, page marketing).
    desc: SERVICE_CARD_LONG_DESC[s.name] ?? s.description,
    includes: s.includes,
    featured: s.featured,
    icon: s.icon,
  }));
}

// Descriptions longues spécifiques à la page marketing /services (conservées telles quelles).
const SERVICE_CARD_LONG_DESC: Record<string, string> = {
  "Coupe + Lavage":
    "Notre service signature. Shampoing, coupe classique adaptée à votre style, et finition impeccable.",
  "Coupe + Barbe à la lame":
    "L'expérience complète pour l'homme moderne. Coupe précise et rasage traditionnel à la lame droite.",
  "Coupe + Barbe Shaver":
    "Coupe, barbe & rasage à la tondeuse (shaver). Un look net et précis sans la lame droite.",
  "Service Premium":
    "Notre service haut de gamme. Une expérience de barbier complète du début à la fin.",
  "Rasage / Barbe":
    "Pour un rasage net ou une barbe bien taillée. Tondeuse, lame droite et serviette chaude.",
  "Enfant (12 ans et moins)":
    "Coupe pour enfant de 12 ans et moins (preuve d'âge).",
};

// Forme utilisée dans l'agenda admin : { label, price (nombre) }.
export type ServiceOption = { label: string; price: number };

export function toServiceOptions(): ServiceOption[] {
  return FALLBACK_SERVICES.map(s => ({ label: s.name, price: s.price }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK SPÉCIFIQUE À L'API (/api/services/route.ts)
//
// L'API renvoie historiquement une liste légèrement différente : descriptions
// plus détaillées + le rasage découpé en DEUX entrées (shaver 25$ / lame 30$),
// soit 7 services. On préserve EXACTEMENT ce comportement pour ne pas changer
// la réponse de l'API. Cette liste n'est PAS dérivée de la canonique car sa
// forme diffère volontairement (héritage existant).
// ─────────────────────────────────────────────────────────────────────────────
export const FALLBACK_API_SERVICES: ApiServiceRow[] = [
  { name: "Coupe + Lavage", price: 35, duration_min: 45, description: "Coupe classique avec shampoing", icon: "✂️" },
  { name: "Coupe + Barbe à la lame", price: 50, duration_min: 60, description: "Coupe, rasage lame", icon: "🪒" },
  { name: "Coupe + Barbe Shaver", price: 45, duration_min: 45, description: "Coupe, barbe au shaver", icon: "🧔" },
  { name: "Service Premium", price: 75, duration_min: 75, description: "Coupe, rasage, serviette chaude", icon: "👑" },
  { name: "Rasage / Barbe au shaver", price: 25, duration_min: 30, description: "Rasage & barbe au shaver", icon: "🧔" },
  { name: "Rasage / Barbe à la lame", price: 30, duration_min: 30, description: "Rasage & barbe à la lame", icon: "🪒" },
  { name: "Enfant (12 ans et moins)", price: 30, duration_min: 30, description: "Coupe enfant 12 ans et moins", icon: "👦" },
];
