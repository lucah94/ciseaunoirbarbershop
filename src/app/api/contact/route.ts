import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";

const contactSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  email: z.string().email("Courriel invalide"),
  message: z.string().min(1, "Le message est requis").max(2000),
});

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ciseaunoirbarbershop@gmail.com";

async function generateAutoReply(name: string, message: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Tu es l'assistant de Ciseau Noir Barbershop à Québec. Un client nommé "${name}" a envoyé ce message via le formulaire de contact :

"${message}"

Rédige une réponse email courte, chaleureuse et professionnelle en français.
- Confirme la réception du message
- Réponds brièvement à la question si possible (services, prix, horaires, etc.)
- Informe que l'équipe reviendra rapidement pour les demandes complexes
- Rappelle qu'ils peuvent réserver en ligne sur ciseunoirbarbershop.com
- Mentionne le numéro (418) 665-5703 si urgent

Infos utiles:
- Services: Coupe adulte 35$, Coupe+Barbe 45$, Coupe enfant 25$, Barbe 20$, Coupe+Lavage 35$
- Horaires: Mar-Mer 8h30-16h30, Jeu-Ven 8h30-20h30, Sam 8h30-16h30, Dim-Lun fermé
- Coiffeurs: Melynda et Diodis

Écris seulement le corps du message email, sans objet ni signature.`,
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return (
    textBlock?.text ||
    `Bonjour ${name},\n\nMerci pour votre message ! Nous l'avons bien reçu et vous répondrons dans les plus brefs délais.\n\nPour réserver en ligne : ciseunoirbarbershop.com\nPour nous joindre : (418) 665-5703`
  );
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req, { limit: 10, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawBody = await req.json();

    const result = contactSchema.safeParse(rawBody);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
    }

    const { name, email, message } = result.data;

    // 1. Notify admin
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `Message de ${name} — Ciseau Noir`,
      html: `
        <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 32px; max-width: 560px; margin: 0 auto;">
          <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 16px;">Nouveau message — Ciseau Noir</p>
          <p style="color: #999; margin-bottom: 8px;"><strong style="color: #F5F5F5;">Nom :</strong> ${escapeHtml(name)}</p>
          <p style="color: #999; margin-bottom: 16px;"><strong style="color: #F5F5F5;">Courriel :</strong> ${escapeHtml(email)}</p>
          <div style="background: #111; border: 1px solid #1A1A1A; padding: 20px; margin-top: 16px;">
            <p style="color: #F5F5F5; font-size: 14px; line-height: 1.7; margin: 0;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
          </div>
          <p style="color: #444; font-size: 12px; margin-top: 24px;">⚡ Une réponse automatique a été envoyée à ${email}.</p>
        </div>
      `,
    });

    // 2. Generate Claude auto-reply
    const autoReplyText = await generateAutoReply(name, message);
    const autoReplyHtml = autoReplyText.replace(/\n/g, "<br>");

    // 3. Send auto-reply to client
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Merci pour votre message — Ciseau Noir`,
      html: `
        <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
          <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
          <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Message reçu</h1>
          <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>
          <div style="color: #CCC; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">${autoReplyHtml}</div>
          <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 32px;">
            <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
              📍 375 Bd des Chutes, Québec, QC<br>
              📞 (418) 665-5703<br>
              🌐 ciseunoirbarbershop.com
            </p>
          </div>
          <p style="color: #333; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
