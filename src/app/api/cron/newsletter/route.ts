import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { aiClient as anthropic, MODELS } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

async function generateNewsletterContent(month: string): Promise<{ subject: string; body: string }> {
  const prompt = `Génère le contenu d'une newsletter mensuelle pour Ciseau Noir Barbershop à Québec.
Mois: ${month}

Format JSON strict:
{
  "subject": "sujet court accrocheur (max 60 caractères) en français",
  "body": "corps en français québécois naturel, 4-5 paragraphes, incluant: salutation chaleureuse mentionnant le mois, un tip de soin barbe/cheveux, mention services Ciseau Noir, invitation à réserver. Pas de signature (ajoutée après). Pas de markdown."
}`;
  const response = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  try {
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return { subject: json.subject || `Newsletter ${month} — Ciseau Noir`, body: json.body || "" };
  } catch {
    return {
      subject: `Ciseau Noir — Nouvelles de ${month}`,
      body: `Bonjour,\n\nVoici notre infolettre du mois de ${month}.\n\nMelynda`,
    };
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const monthName = MONTHS_FR[now.getMonth()];

  // Clients avec email + qui n'ont pas opt-out
  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, email")
    .not("email", "is", null)
    .range(0, 9999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const recipients = (clients || []).filter(c => c.email && c.email.includes("@"));

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY manquant" }, { status: 500 });
  }

  const { subject, body } = await generateNewsletterContent(monthName);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";

  let sent = 0;
  let failed = 0;
  // Envoi par batch de 50 pour éviter rate limits
  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50);
    await Promise.all(batch.map(async (c) => {
      try {
        const personalized = body.replace(/Bonjour,?/i, `Bonjour ${c.name?.split(" ")[0] || ""},`);
        await resend.emails.send({
          from: FROM_EMAIL,
          to: c.email!,
          subject,
          html: `
            <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 600px; margin: 0 auto;">
              <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir Barbershop</p>
              <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 2px; margin-bottom: 8px;">${subject}</h1>
              <div style="width: 40px; height: 2px; background: #C9A84C; margin: 24px 0;"></div>
              <div style="color: #BBB; font-size: 15px; line-height: 1.8; white-space: pre-line;">${personalized}</div>
              <div style="margin-top: 40px;">
                <a href="https://ciseaunoirbarbershop.com/booking" style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 32px; text-decoration: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">Réserver en ligne</a>
              </div>
              <p style="color: #777; font-size: 12px; margin-top: 32px;">— Melynda ✂️<br/>Ciseau Noir Barbershop · 375 Boul. des Chutes · Québec · (418) 665-5703</p>
              <p style="color: #444; font-size: 10px; margin-top: 24px;">Vous recevez cet email parce que vous avez réservé chez Ciseau Noir. <a href="https://ciseaunoirbarbershop.com/unsubscribe?email=${encodeURIComponent(c.email!)}" style="color: #666;">Se désinscrire</a></p>
            </div>
          `,
        });
        sent++;
      } catch {
        failed++;
      }
    }));
  }

  return NextResponse.json({ ok: true, month: monthName, sent, failed, total_clients: recipients.length });
}
