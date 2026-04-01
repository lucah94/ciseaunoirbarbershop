import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CONTENT_PROMPTS: Record<string, string> = {
  promotion: `Génère une publication Facebook promotionnelle pour Ciseau Noir Barbershop à Québec. Mentionne une offre spéciale, un service ou incite à réserver en ligne sur ciseaunoirbarbershop.com. Utilise des emojis appropriés. 2-4 phrases max. En français.`,
  service: `Génère une publication Facebook qui met en avant un service de Ciseau Noir Barbershop. Choisis parmi : Coupe adulte (35$), Coupe + Barbe (45$), Coupe enfant (25$), Barbe (20$), Coupe + Lavage (35$). Décris le service avec enthousiasme. Inclus les coiffeurs Melynda et Diodis. Utilise des emojis. 3-4 phrases. En français.`,
  tip: `Génère un conseil de coiffure ou de soin de barbe pour les clients de Ciseau Noir Barbershop. Partage un conseil professionnel utile. Mentionne que les experts Melynda et Diodis peuvent aider. Utilise des emojis. 3-4 phrases. En français.`,
  appreciation: `Génère un message de remerciement chaleureux envers les clients de Ciseau Noir Barbershop. Exprime de la gratitude, invite à laisser un avis Google, et encourage à revenir. Utilise des emojis. 2-3 phrases. En français.`,
  inspirational: `Génère un message inspirationnel lié à la confiance en soi, l'apparence et le style pour Ciseau Noir Barbershop. Relie cela aux services du salon. Utilise des emojis. 2-3 phrases. En français.`,
};

export async function POST(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { type = "promotion" } = await req.json().catch(() => ({}));
  const prompt = CONTENT_PROMPTS[type] || CONTENT_PROMPTS.promotion;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `${prompt}\n\nInfos:\n- Adresse: 375 Boul. des Chutes, Québec\n- Téléphone: (418) 665-5703\n- Site: ciseaunoirbarbershop.com\n\nGénère uniquement le texte de la publication, sans guillemets ni introduction.`,
    }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return NextResponse.json({ text: textBlock?.text || "" });
}
