import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";

const contactSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  email: z.string().email("Courriel invalide"),
  message: z.string().min(1, "Le message est requis").max(2000),
});

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ciseaunoirbarbershop@gmail.com";

const ESCALATION_KEYWORDS = ["plainte","plaindre","problème","remboursement","pas content","mécontent","terrible","horrible","erreur","arnaque","urgent","accident","insatisfait","volé","scandale"];

async function generateAutoReply(name: string, message: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 450,
    system: `Tu es Figaro ✂️, l'assistant IA de Ciseau Noir Barbershop à Québec. Tu réponds aux clients avec chaleur et professionnalisme en français québécois.
Infos salon :
- Services: Coupe homme 35$, Coupe+Barbe 50$, Coupe enfant 25$, Barbe 20$, Coupe+Barbe+Lavage 55$
- Horaires: Mar-Mer 8h30-16h30, Jeu-Ven 8h30-20h30, Sam 8h30-16h30, Dim-Lun fermé
- Adresse: 375 Bd des Chutes, Québec
- Téléphone: (418) 665-5703
- Réservation: ciseaunoir.ca
- Coiffeurs: Melynda (propriétaire) et Diodis
Signe toujours avec : Figaro ✂️ — Assistant Ciseau Noir`,
    messages: [
      {
        role: "user",
        content: `Le client ${name} écrit : "${message}"\n\nRédige une réponse email concise et chaleureuse. Si la demande nécessite une intervention humaine (plainte, situation complexe), dis-leur que Melynda les contactera très bientôt.`,
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return (
    textBlock?.text ||
    `Bonjour ${name},\n\nMerci pour votre message ! Je l'ai bien reçu et l'équipe vous répondra rapidement.\n\nRéservation : ciseaunoir.ca\nUrgent : (418) 665-5703\n\nFigaro ✂️ — Assistant Ciseau Noir`
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

    // 2. Generate Figaro auto-reply
    const autoReplyText = await generateAutoReply(name, message);
    const autoReplyHtml = autoReplyText.replace(/\n/g, "<br>");

    // 3. Check if escalation needed
    const msgLower = message.toLowerCase();
    const escalated = ESCALATION_KEYWORDS.some(k => msgLower.includes(k));

    // 4. Save to figaro_messages
    await supabaseAdmin.from("figaro_messages").insert({
      from_name: name,
      from_email: email,
      message,
      ai_response: autoReplyText,
      escalated,
    });

    // 5. If escalated, send SMS to Melynda
    if (escalated && process.env.MELYNDA_PHONE) {
      await sendSMS(
        process.env.MELYNDA_PHONE,
        `Figaro ✂️ — Message de ${name} (${email}): "${message.slice(0, 120)}..." → Suivi requis !`
      ).catch(() => {});
    }

    // 6. Send auto-reply to client
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Message reçu — Ciseau Noir`,
      html: `
        <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
          <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
          <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Message reçu ✓</h1>
          <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>
          <div style="color: #CCC; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">${autoReplyHtml}</div>
          <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 32px;">
            <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
              📍 375 Bd des Chutes, Québec, QC<br>
              📞 (418) 665-5703<br>
              🌐 ciseaunoir.ca
            </p>
          </div>
          <p style="color: #444; font-size: 11px; text-align: center; letter-spacing: 1px;">Figaro ✂️ — Assistant IA de Ciseau Noir</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
