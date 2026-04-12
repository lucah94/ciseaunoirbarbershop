import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es Figaro, l'assistant IA de Ciseau Noir Barbershop à Québec.
Tu génères du contenu marketing professionnel et accrocheur pour le salon.

Infos sur le salon :
- Nom : Ciseau Noir Barbershop
- Adresse : 375 Bd des Chutes, Québec
- Téléphone : (418) 665-5703
- Site : ciseaunoirbarbershop.com
- Réservations : ciseaunoirbarbershop.com/booking
- Programme fidélité : 10e coupe gratuite — ciseaunoirbarbershop.com/fidelite
- Barbières : Melynda et Diodis
- Style : élégant, moderne, chaleureux, inclusif

Quand on te demande de générer un EMAIL, réponds EXACTEMENT dans ce format JSON :
{"type":"email","subject":"...","body":"..."}

Quand on te demande de générer un SMS, réponds EXACTEMENT dans ce format JSON :
{"type":"sms","body":"..."}

Le corps du message doit être naturel, chaleureux, en français québécois professionnel.
Pour les SMS : max 160 caractères, toujours terminer par "Répondez STOP pour ne plus recevoir de msgs."
Pour les emails : 3-5 phrases, signe toujours "— Melynda & l'équipe Ciseau Noir 🖤"
Ne mets jamais de balises HTML dans le body.`;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { prompt, type } = await req.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requis" }, { status: 400 });

  const userMessage = type
    ? `Génère un ${type === "sms" ? "SMS" : "email"} pour : ${prompt}`
    : prompt;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch {
    // Fallback si pas de JSON valide
    return NextResponse.json({ type: "text", body: text });
  }
}
