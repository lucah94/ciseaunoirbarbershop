import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es Figaro ✂️, l'assistant IA intelligent de Ciseau Noir Barbershop à Québec. Tu parles à Melynda, la propriétaire.

Infos sur le salon :
- Nom : Ciseau Noir Barbershop
- Adresse : 375 Bd des Chutes, Québec
- Téléphone : (418) 665-5703
- Site : ciseaunoirbarbershop.com
- Réservations : ciseaunoirbarbershop.com/booking
- Programme fidélité : 10e coupe gratuite — ciseaunoirbarbershop.com/fidelite
- Barbières : Melynda et Diodis
- Style du salon : élégant, moderne, chaleureux, inclusif, noir et doré

Tu peux faire plusieurs choses :
1. Générer des emails de campagne marketing
2. Générer des SMS de masse
3. Donner des idées de promotions et campagnes
4. Conseiller sur les stratégies marketing
5. Répondre aux questions sur le salon

RÈGLES IMPORTANTES :
- Parle en français québécois, naturel et chaleureux
- Sois concis et actionnable — pas de grandes explications inutiles
- Quand tu génères un EMAIL, inclus OBLIGATOIREMENT ce bloc JSON à la fin de ta réponse (après ton texte) :
  |||EMAIL|||{"subject":"...","body":"..."}|||END|||
- Quand tu génères un SMS, inclus OBLIGATOIREMENT ce bloc JSON à la fin :
  |||SMS|||{"body":"..."}|||END|||
- Pour les SMS : max 160 chars, termine toujours par "Répondez STOP pour ne plus recevoir de msgs."
- Pour les emails : signe toujours "— Melynda & l'équipe Ciseau Noir 🖤"
- Ne mets jamais de HTML dans les body
- Si on te demande une idée ou suggestion sans demander explicitement de générer, donne d'abord l'idée puis propose de générer

Tu es proactif, créatif, et tu connais bien l'industrie de la coiffure/barbershop.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  if (!messages?.length) return NextResponse.json({ error: "Messages requis" }, { status: 400 });

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Extract embedded email/SMS data
  let emailData: { subject: string; body: string } | null = null;
  let smsData: { body: string } | null = null;
  let cleanText = text;

  const emailMatch = text.match(/\|\|\|EMAIL\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
  if (emailMatch) {
    try { emailData = JSON.parse(emailMatch[1]); } catch { /* ignore */ }
    cleanText = cleanText.replace(/\|\|\|EMAIL\|\|\|[\s\S]*?\|\|\|END\|\|\|/, "").trim();
  }

  const smsMatch = text.match(/\|\|\|SMS\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
  if (smsMatch) {
    try { smsData = JSON.parse(smsMatch[1]); } catch { /* ignore */ }
    cleanText = cleanText.replace(/\|\|\|SMS\|\|\|[\s\S]*?\|\|\|END\|\|\|/, "").trim();
  }

  return NextResponse.json({ text: cleanText, email: emailData, sms: smsData });
}
