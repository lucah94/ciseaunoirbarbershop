import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchUnreadEmails, markAsRead, sendGmailReply } from "@/lib/gmail";
import { sendSMS } from "@/lib/sms";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ESCALATION_KEYWORDS = ["plainte", "problème", "remboursement", "pas content", "mécontent", "terrible", "horrible", "arnaque", "insatisfait", "volé", "scandale"];

async function analyzeEmail(subject: string, body: string, fromEmail: string): Promise<{
  intent: "CANCEL_BOOKING" | "QUESTION" | "COMPLAINT" | "OTHER";
  reply: string;
}> {
  // Fetch client's upcoming bookings to give context to the AI
  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("id, client_name, service, barber, date, time, status")
    .eq("client_email", fromEmail)
    .neq("status", "cancelled")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .limit(3);

  const bookingContext = bookings?.length
    ? `Réservations actives de ce client :\n${bookings.map(b =>
        `- ${b.service} avec ${b.barber} le ${b.date} à ${b.time} (ID: ${b.id})`
      ).join("\n")}`
    : "Aucune réservation active trouvée pour cet email.";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `Tu es Figaro ✂️, l'assistant IA de Ciseau Noir Barbershop à Québec. Tu analyses les emails reçus par le salon et tu réponds automatiquement.

Infos salon :
- Services: Coupe homme 35$, Coupe+Barbe 50$, Coupe enfant 25$, Barbe 20$
- Horaires: Mar-Mer 8h30-16h30, Jeu-Ven 8h30-20h30, Sam 8h30-16h30, Dim-Lun fermé
- Téléphone: (418) 665-5703
- Réservation: ciseaunoirbarbershop.com

${bookingContext}

Tu dois retourner un JSON avec :
- "intent": "CANCEL_BOOKING" si le client veut annuler, "QUESTION" si question générale, "COMPLAINT" si plainte, "OTHER" sinon
- "booking_id": l'ID du RDV à annuler (si CANCEL_BOOKING et un seul RDV actif, prends celui-là; sinon null)
- "reply": ta réponse en français québécois, chaleureuse et concise

Signe toujours avec : Figaro ✂️ — Assistant Ciseau Noir`,
    messages: [{
      role: "user",
      content: `Email reçu de ${fromEmail}\nSujet: ${subject}\n\n${body}\n\nRéponds en JSON uniquement.`,
    }],
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text || "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return { intent: "OTHER", reply: `Bonjour,\n\nMerci pour votre message ! Notre équipe va vous répondre très bientôt.\n\n(418) 665-5703\n\nFigaro ✂️ — Assistant Ciseau Noir` };
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!process.env.GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ error: "GMAIL_REFRESH_TOKEN non configuré" }, { status: 503 });
  }

  try {
    const emails = await fetchUnreadEmails();
    if (!emails.length) return NextResponse.json({ processed: 0 });

    let processed = 0;
    const results = [];

    for (const email of emails) {
      try {
        const analysis = await analyzeEmail(email.subject, email.body, email.fromEmail);

        // Cancel booking if requested
        let bookingCancelled = false;
        const bookingId = (analysis as { booking_id?: string }).booking_id;
        if (analysis.intent === "CANCEL_BOOKING" && bookingId) {
          await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
          bookingCancelled = true;
        }

        // Reply to client via Gmail
        await sendGmailReply({
          threadId: email.threadId,
          to: email.fromEmail,
          subject: email.subject,
          body: analysis.reply,
        });

        // Check escalation
        const msgLower = (email.subject + " " + email.body).toLowerCase();
        const escalated = analysis.intent === "COMPLAINT" || ESCALATION_KEYWORDS.some(k => msgLower.includes(k));

        if (escalated && process.env.MELYNDA_PHONE) {
          await sendSMS(
            process.env.MELYNDA_PHONE,
            `Figaro ✂️ — Email de ${email.from}: "${email.subject}" → Suivi requis !`
          ).catch(() => {});
        }

        // Save to figaro_messages
        await supabaseAdmin.from("figaro_messages").insert({
          from_name: email.from.split("<")[0].trim() || email.fromEmail,
          from_email: email.fromEmail,
          message: `[EMAIL] Sujet: ${email.subject}\n\n${email.body}`,
          ai_response: analysis.reply,
          escalated,
        });

        // Mark as read
        await markAsRead(email.id);

        processed++;
        results.push({ email: email.fromEmail, intent: analysis.intent, bookingCancelled });
      } catch (err) {
        console.error(`Email processing error for ${email.fromEmail}:`, err);
      }
    }

    return NextResponse.json({ processed, results });
  } catch (e) {
    console.error("check-emails cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
