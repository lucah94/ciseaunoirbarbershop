import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { generateText, MODELS } from "@/lib/ai";
export const dynamic = 'force-dynamic';

const CONTENT_PROMPTS: Record<string, string> = {
  promotion: `Génère une publication Facebook promotionnelle pour Ciseau Noir Barbershop à Québec. Mentionne une offre spéciale, un service ou incite à réserver en ligne sur ciseaunoirbarbershop.com. Utilise des emojis appropriés. 2-4 phrases max. En français.`,
  service: `Génère une publication Facebook qui met en avant un service de Ciseau Noir Barbershop. Choisis parmi : Coupe + Lavage (35$), Coupe + Barbe à la lame (50$), Coupe + Barbe Shaver (45$), Service Premium (75$), Rasage / Barbe (25$), Enfant 12 ans et moins (30$). Décris le service avec enthousiasme. Mentionne la barbière Melynda. Utilise des emojis. 3-4 phrases. En français.`,
  tip: `Génère un conseil de coiffure ou de soin de barbe pour les clients de Ciseau Noir Barbershop. Partage un conseil professionnel utile. Mentionne que Melynda peut aider. Utilise des emojis. 3-4 phrases. En français.`,
  appreciation: `Génère un message de remerciement chaleureux envers les clients de Ciseau Noir Barbershop. Exprime de la gratitude, invite à laisser un avis Google, et encourage à revenir. Utilise des emojis. 2-3 phrases. En français.`,
  inspirational: `Génère un message inspirationnel lié à la confiance en soi, l'apparence et le style pour Ciseau Noir Barbershop. Relie cela aux services du salon. Utilise des emojis. 2-3 phrases. En français.`,
};

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { type = "promotion" } = await req.json().catch(() => ({}));
  const prompt = CONTENT_PROMPTS[type] || CONTENT_PROMPTS.promotion;

  const text = await generateText({
    model: MODELS.FREE,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `${prompt}\n\nInfos:\n- Adresse: 375 Boul. des Chutes, Québec\n- Téléphone: (418) 665-5703\n- Site: ciseaunoirbarbershop.com\n\nGénère uniquement le texte de la publication, sans guillemets ni introduction.`,
    }],
  });

  return NextResponse.json({ text });
}
