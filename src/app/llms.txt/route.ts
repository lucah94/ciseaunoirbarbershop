import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * llms.txt — résumé condensé du site pour les crawlers de modèles de langage
 * (ChatGPT, Perplexity, Claude...). Coût quasi nul à maintenir, valeur incertaine :
 * Google (Gary Illyes, John Mueller) a confirmé publiquement ne PAS s'appuyer
 * dessus — le vrai travail SEO/IA reste le schema.org structuré (JsonLd.tsx),
 * le contenu visible et les avis. Ce fichier est un complément, pas une stratégie.
 * Rien ici qui ne soit pas déjà public ailleurs sur le site.
 */
const CONTENT = `# Ciseau Noir Barbershop

> Barbershop premium à Beauport (ville de Québec), Canada. Coupes homme, rasage à la lame et taille de barbe.

Adresse : 2275 Avenue Royale, Québec, QC G1C 1P5 (secteur Courville, Beauport) — déménagé en septembre 2026, anciennement au 375 boulevard des Chutes.
Téléphone : (418) 665-5703
Site : https://ciseaunoirbarbershop.com

## Horaires
Mardi et mercredi : 8 h 30 – 16 h 30
Jeudi et vendredi : 8 h 30 – 19 h
Samedi : 9 h – 16 h 30
Fermé dimanche et lundi.

## Services et tarifs (25$–75$)
- Rasage / Barbe (shaver) : 25$
- Coupe + Lavage : 35$
- Coupe + Barbe Shaver : 45$
- Enfant (12 ans et moins) : 30$
- Coupe + Barbe à la lame : 60$
- Service Premium (shampoing, coupe, rasage, serviette chaude, exfoliant) : 75$
Liste complète et à jour : https://ciseaunoirbarbershop.com/services

## Équipe
Melynda — barbière et co-fondatrice
Stéphanie — barbière

## Pages
- Réservation en ligne : https://ciseaunoirbarbershop.com/booking
- Services & tarifs : https://ciseaunoirbarbershop.com/services
- Contact & FAQ : https://ciseaunoirbarbershop.com/contact
- Notre équipe : https://ciseaunoirbarbershop.com/team

## Notes
- Réservation en ligne recommandée, moins d'une minute. Confirmation par SMS et courriel.
- Le client peut annuler ou modifier son rendez-vous lui-même via le lien reçu.
- Programme de fidélité : la 10e coupe est gratuite après 10 visites.
- Note Google : 5.0/5 (avis vérifiés sur la fiche Google Business).
`;

export async function GET() {
  return new NextResponse(CONTENT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
