import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";

// Appel IA AVEC outils (tool use) + FALLBACK Sonnet — comme generateText de @/lib/ai,
// mais qui préserve les tools / stop_reason (generateText ne retourne qu'un string).
async function createWithFallback(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model"> & { model: string }
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (e) {
    console.error(`[check-emails] modèle "${params.model}" a échoué — fallback Sonnet:`, e);
    if (params.model === MODELS.SMART) throw e;
    return await anthropic.messages.create({ ...params, model: MODELS.SMART });
  }
}
import { supabaseAdmin } from "@/lib/supabase";
import { fetchUnreadEmails, markAsRead, sendGmailReply, archiveEmail, deleteEmail } from "@/lib/gmail";
import { sendSMS } from "@/lib/sms";
import { notifyEscalation, notifyBookingCancelled, sendEmailApprovalRequest } from "@/lib/telegram";
import { runCron } from "@/lib/cron-log";
export const dynamic = 'force-dynamic';

export const maxDuration = 120;


const ESCALATION_KEYWORDS = ["plainte", "problème", "remboursement", "pas content", "mécontent", "terrible", "horrible", "arnaque", "insatisfait", "volé", "scandale"];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";

// ── Tier 1: Auto-archive silently, no AI, no Telegram ─────────────────────────
// Pure infrastructure/dev noise — Melynda doesn't care about these
const SILENT_ARCHIVE_SENDERS = [
  "notifications@vercel.com", "noreply@vercel.com",
  "alert@uptimerobot.com", "noreply@uptimerobot.com",
  "ads-noreply@google.com", "ads-account-noreply@google.com",
  "noreply@github.com", "security@github.com", "support@github.com",
  "noreply@supabase.com", "noreply@supabase.io", "notify@supabase.io",
  "workspace-noreply@google.com", "googleplay-noreply@google.com",
  "google-maps-noreply@google.com",
  "mailer-daemon@googlemail.com", "mailer-daemon@google.com",
  "hello@resend.com", "noreply@resend.com",
  "noreply@anthropic.com", "no-reply@email.claude.com",
  "no-reply@wixsiteautomations.com", "no-reply@wix.com",
];
const SILENT_ARCHIVE_SUBJECT_KEYWORDS = [
  "failed production deployment", "deployment completed", "build failed",
  "your twilio account has been recharged", "uptimerobot alert",
  "vercel alert", "vercel notification", "google workspace",
  "delivery status notification", "mailer-daemon",
  "github action", "dependabot", "security advisory",
];

// ── Tier 2: Keep in inbox + brief Telegram alert (no AI reply needed) ─────────
// Business-critical for Melynda — she must see these
const BUSINESS_ALERT_SENDERS = [
  "catch@payments.interac.ca", "interac@interac.ca", "notification@interac.ca",
  "canadastatementopsdoNotreply@chasepaymentech.com",
  "espaceclient.quebec@intact.ca", "noreply@intact.ca",
  "smorin@ellipse.ca", "ellipse.ca",  // assurances du salon — IMPORTANT
  "noreply@primaco.ca", "primaco",
  "microsoft-noreply@microsoft.com",
  "noreply@twilio.com", "notifications@twilio.com", "alerts@twilio.com",
];
const BUSINESS_ALERT_SUBJECT_KEYWORDS = [
  "loyer", "bail", "location", "relevé du marchand", "statement",
  "assurance", "insurance", "réclamation", "alerte de sécurité",
  "action requise", "renouvellement", "abonnement microsoft",
  "mise en demeure", "avis d'expiration", "permis",
];

// ── Tier 2b: Supplier emails — alert Melynda, no auto-reply ──────────────────
// Add your suppliers here
const SUPPLIER_KEYWORDS = [
  "bestbarber", "salon centric", "cosmoprof", "l'oreal", "loreal",
  "wahl", "andis", "osmo", "babyliss", "oster", "fournisseur",
  "commande", "livraison", "stock", "produit", "facture fournisseur",
  "invoice", "order confirmation", "your order",
];

// ── Tier 3: Real client emails — AI processes and replies ──────────────────────
// Everyone else who emails the barbershop directly
const KNOWN_SPAM_SENDERS = [
  "linkedin.com", "twitter.com", "instagram.com", "facebook.com",
  "groupon", "wish.com", "amazon.com", "ebay@",
];

// Keywords that flag email as IMPORTANT (needs Melynda approval before AI replies)
const IMPORTANT_KEYWORDS = [
  "avocat", "tribunal", "contrat", "bail", "mise en demeure", "poursuite", "juridique",
  "impôt", "revenu", "cra@", "gouvernement", "municipal", "inspection", "règlement",
  "recouvrement", "dette", "huissier",
];

// ── Tools pour l'agent ────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "get_availability",
    description: "Retourne les créneaux disponibles pour un barbier et une date donnée. Utilise ceci avant de proposer ou de créer un RDV.",
    input_schema: {
      type: "object" as const,
      properties: {
        barber: { type: "string", enum: ["Melynda"], description: "Nom du barbier" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
      },
      required: ["barber", "date"],
    },
  },
  {
    name: "create_booking",
    description: "Crée un nouveau rendez-vous pour un client qui en demande un par email.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string" },
        client_email: { type: "string" },
        client_phone: { type: "string", description: "Optionnel si pas connu" },
        service: { type: "string", description: "ex: Coupe + Lavage, Coupe + Barbe à la lame, Coupe + Barbe Shaver, Service Premium, Rasage / Barbe, Enfant (12 ans et moins)" },
        barber: { type: "string", enum: ["Melynda"] },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM (ex: 10:00)" },
        price: { type: "number", description: "Prix du service" },
        note: { type: "string", description: "Note optionnelle" },
      },
      required: ["client_name", "client_email", "service", "barber", "date", "time", "price"],
    },
  },
  {
    name: "cancel_booking",
    description: "Annule un rendez-vous existant pour le client.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_id: { type: "string", description: "ID du RDV à annuler" },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "reschedule_booking",
    description: "Déplace un rendez-vous existant à une nouvelle date/heure.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_id: { type: "string" },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_time: { type: "string", description: "HH:MM" },
      },
      required: ["booking_id", "new_date", "new_time"],
    },
  },
  {
    name: "get_client_bookings",
    description: "Retourne les réservations actives (futures) du client qui envoie l'email.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_email: { type: "string" },
      },
      required: ["client_email"],
    },
  },
  {
    name: "archive_email",
    description: "Archive l'email (retire de la boîte de réception). Utilise pour : newsletters, confirmations traitées, emails informatifs sans action requise.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "delete_email",
    description: "Supprime l'email (met à la corbeille). Utilise pour : spam, promotions non sollicitées, emails sans valeur.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

// ── Exécution des tools ───────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "get_client_bookings") {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, client_name, service, barber, date, time, status, price")
      .eq("client_email", input.client_email as string)
      .neq("status", "cancelled")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(5);
    if (!data?.length) return "Aucune réservation active trouvée.";
    return data.map(b => `ID:${b.id} | ${b.service} avec ${b.barber} | ${b.date} à ${b.time} | ${b.price}$`).join("\n");
  }

  if (name === "get_availability") {
    const { barber, date } = input as { barber: string; date: string };
    const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=dim, 1=lun
    if (dayOfWeek === 0 || dayOfWeek === 1) return "Fermé ce jour (dimanche ou lundi).";

    const isLongDay = dayOfWeek === 4 || dayOfWeek === 5; // jeu-ven = jusqu'à 20h30
    const allSlots: string[] = [];
    const start = 8 * 60 + 30;
    const end = isLongDay ? 20 * 60 + 30 : 16 * 60 + 30;
    for (let m = start; m < end; m += 15) {
      allSlots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }

    const { data: booked } = await supabaseAdmin
      .from("bookings")
      .select("time, end_time, service")
      .eq("barber", barber)
      .eq("date", date)
      .neq("status", "cancelled");

    const busyMinutes = new Set<number>();
    for (const b of booked || []) {
      const [sh, sm] = (b.time || "0:0").split(":").map(Number);
      const startMin = sh * 60 + sm;
      let endMin = startMin + 45;
      if (b.end_time) {
        const [eh, em] = b.end_time.split(":").map(Number);
        endMin = eh * 60 + em;
      }
      for (let m = startMin; m < endMin; m++) busyMinutes.add(m);
    }

    const free = allSlots.filter(t => {
      const [h, min] = t.split(":").map(Number);
      return !busyMinutes.has(h * 60 + min);
    });

    if (!free.length) return `Aucun créneau libre le ${date} pour ${barber}.`;
    return `Créneaux libres le ${date} pour ${barber} : ${free.slice(0, 20).join(", ")}${free.length > 20 ? ` (+ ${free.length - 20} autres)` : ""}`;
  }

  if (name === "create_booking") {
    const b = input as {
      client_name: string; client_email: string; client_phone?: string;
      service: string; barber: string; date: string; time: string; price: number; note?: string;
    };
    const { data, error } = await supabaseAdmin.from("bookings").insert([{
      client_name: b.client_name,
      client_email: b.client_email,
      client_phone: b.client_phone || "",
      service: b.service,
      barber: b.barber,
      date: b.date,
      time: b.time,
      price: b.price,
      note: b.note || "Réservé par email via Figaro",
      status: "confirmed",
      source: "email",
    }]).select().single();
    if (error) return `Erreur création RDV: ${error.message}`;
    // Note: bookings/route.ts already sends Telegram notification — no duplicate here
    return `RDV créé avec succès ! ID: ${data.id} | ${b.service} avec ${b.barber} le ${b.date} à ${b.time}`;
  }

  if (name === "cancel_booking") {
    const { data: booking } = await supabaseAdmin
      .from("bookings").select("*").eq("id", input.booking_id as string).single();
    if (!booking) return "RDV introuvable.";
    await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", input.booking_id as string);
    notifyBookingCancelled(booking).catch(() => {});
    return `RDV annulé : ${booking.service} avec ${booking.barber} le ${booking.date} à ${booking.time}`;
  }

  if (name === "reschedule_booking") {
    const { booking_id, new_date, new_time } = input as { booking_id: string; new_date: string; new_time: string };
    const { data: booking } = await supabaseAdmin.from("bookings").select("*").eq("id", booking_id).single();
    if (!booking) return "RDV introuvable.";
    await supabaseAdmin.from("bookings").update({ date: new_date, time: new_time }).eq("id", booking_id);
    return `RDV déplacé : ${booking.service} avec ${booking.barber} → ${new_date} à ${new_time}`;
  }

  if (name === "archive_email" || name === "delete_email") {
    return "Action sera appliquée après le traitement.";
  }

  return "Outil inconnu.";
}

// ── Agent principal ───────────────────────────────────────────────────────────

function isImportantEmail(email: { from: string; fromEmail: string; subject: string; body: string }): boolean {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  return IMPORTANT_KEYWORDS.some(kw => text.includes(kw));
}

async function processEmailWithAgent(email: {
  id: string; threadId: string; from: string; fromEmail: string; subject: string; body: string;
}): Promise<{ reply: string; intent: string; actionsPerformed: string[]; emailAction: "archive" | "delete" | "keep" }> {
  const today = new Date().toISOString().slice(0, 10);
  const actionsPerformed: string[] = [];

  const systemPrompt = `Tu es Figaro ✂️, l'agent IA de Ciseau Noir Barbershop à Québec. Tu traites les emails reçus par le salon de façon AUTONOME — tu prends les actions nécessaires sans attendre confirmation humaine.

Infos salon :
- Services : Coupe + Lavage 35$, Coupe + Barbe à la lame 50$, Coupe + Barbe Shaver 45$, Service Premium 75$, Rasage/Barbe 25$, Enfant 12 ans et moins 30$
- Horaires : Mar-Mer 8h30-16h30, Jeu-Ven 8h30-20h30, Sam 8h30-16h30, Dim-Lun FERMÉ
- Adresse : 375 Bd des Chutes, Québec
- Téléphone : (418) 665-5703
- Réservation en ligne : ${SITE_URL}/booking
- Aujourd'hui : ${today}

RÈGLES DE TRAITEMENT :
- RDV demandé → get_availability + create_booking → réponds + archive_email
- Annulation → cancel_booking → réponds + archive_email
- Déplacement → get_availability + reschedule_booking → réponds + archive_email
- Question simple (horaires, prix, adresse) → réponds + archive_email
- Plainte / situation complexe → réponds (dis que Melynda rappellera) + KEEP dans inbox
- Spam / promo non sollicitée → delete_email SANS répondre
- Newsletter / confirmation automatique → delete_email SANS répondre
- Email important (assurance, légal, fiscal, gouvernement, fournisseur) → rédige une réponse professionnelle mais NE L'ENVOIE PAS — laisse l'humain approuver

TOUJOURS terminer ta réponse finale avec exactement une de ces balises sur sa propre ligne :
[URGENT] — plainte, demande humaine requise
[IMPORTANT] — assurance, légal, fiscal, gouvernement, fournisseur — en attente d'approbation
[INFO] — RDV créé/annulé/déplacé, question répondue
[IGNORE] — spam, newsletter, supprimé

Réponds en français québécois, chaleureux et concis.
Signe avec : Figaro ✂️ — Ciseau Noir`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Email de ${email.from} (${email.fromEmail})\nSujet : ${email.subject}\n\n${email.body.slice(0, 1500)}`,
    },
  ];

  let intent = "OTHER";
  let finalReply = "";
  let emailAction: "archive" | "delete" | "keep" = "archive";

  // Agentic loop — max 5 tours. Réponse CLIENT (email) → meilleur modèle (SMART) + fallback Sonnet
  for (let turn = 0; turn < 5; turn++) {
    const response = await createWithFallback({
      model: MODELS.SMART,
      max_tokens: 1000,
      system: systemPrompt,
      tools,
      messages,
    });

    // Detect intent from text
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (textBlock) {
      finalReply = textBlock.text;
      if (textBlock.text.includes("[IMPORTANT]") || isImportantEmail(email)) intent = "IMPORTANT";
      else if (/annul/i.test(email.subject + email.body)) intent = "CANCEL_BOOKING";
      else if (/rendez-vous|réserver|booking|appointment|prendre.*rdv/i.test(email.subject + email.body)) intent = "BOOK_APPOINTMENT";
      else if (ESCALATION_KEYWORDS.some(k => (email.subject + email.body).toLowerCase().includes(k))) intent = "COMPLAINT";
      else intent = "QUESTION";
    }

    if (response.stop_reason === "end_turn") break;

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
        actionsPerformed.push(`${toolUse.name}: ${result.slice(0, 100)}`);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }

  if (!finalReply) {
    finalReply = "Bonjour,\n\nMerci pour votre message ! Nous vous répondrons très bientôt.\n\n(418) 665-5703\n\nFigaro ✂️ — Ciseau Noir";
  }

  // Détecter l'action email depuis les tools appelés
  if (actionsPerformed.some(a => a.startsWith("delete_email"))) emailAction = "delete";
  else if (actionsPerformed.some(a => a.startsWith("archive_email"))) emailAction = "archive";
  else if (intent === "COMPLAINT" || intent === "IMPORTANT") emailAction = "keep";
  else emailAction = "archive";

  return { reply: finalReply, intent, actionsPerformed, emailAction };
}

// ── Route GET (cron) ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel envoie Authorization: Bearer CRON_SECRET (header) OU on passe ?secret= manuellement
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = req.nextUrl.searchParams.get("secret") || req.nextUrl.searchParams.get("key");
    if (bearer !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN && !process.env.GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ error: "GOOGLE_REFRESH_TOKEN non configuré" }, { status: 503 });
  }

  return await runCron("check-emails", async () => {
    const emails = await fetchUnreadEmails();
    if (!emails.length) return NextResponse.json({ processed: 0 });

    let processed = 0;
    const results = [];

    for (const email of emails) {
      try {
        const frm = email.fromEmail.toLowerCase();
        const text = `${email.from} ${email.subject} ${email.body.slice(0, 200)}`.toLowerCase();

        // ── TIER 1: Silent archive — pure dev/infra noise ──────────────────────
        const isSilentArchive =
          SILENT_ARCHIVE_SENDERS.some(s => frm.includes(s)) ||
          SILENT_ARCHIVE_SUBJECT_KEYWORDS.some(k => email.subject.toLowerCase().includes(k));
        if (isSilentArchive) {
          await archiveEmail(email.id);
          processed++;
          results.push({ email: email.fromEmail, intent: "SILENT_ARCHIVE", emailAction: "archive", actionsPerformed: [] });
          continue;
        }

        // ── TIER 2: Business alert — keep in inbox, short Telegram, no AI reply ─
        const isInterac = frm.includes("interac");
        const isInteracImportant = isInterac && (
          text.includes("reçu un virement") ||
          text.includes("accepted your e-transfer") ||
          text.includes("a accepté votre virement") ||
          text.includes("money request") ||
          text.includes("demande de fonds")
        );
        const isBusinessAlert =
          isInteracImportant ||
          (!isInterac && BUSINESS_ALERT_SENDERS.some(s => frm.includes(s.toLowerCase()))) ||
          BUSINESS_ALERT_SUBJECT_KEYWORDS.some(k => text.includes(k));

        // Interac confirmations that are NOT important → silent archive
        if (isInterac && !isInteracImportant) {
          await archiveEmail(email.id);
          processed++;
          results.push({ email: email.fromEmail, intent: "SILENT_ARCHIVE", emailAction: "archive", actionsPerformed: [] });
          continue;
        }

        if (isBusinessAlert) {
          await markAsRead(email.id);
          // Dedup — only notify once per gmail_id
          const { data: alreadyNotified } = await supabaseAdmin
            .from("notified_emails").select("gmail_id").eq("gmail_id", email.id).single();
          if (!alreadyNotified) {
            await supabaseAdmin.from("notified_emails").insert({ gmail_id: email.id });
            const { notifySystemAlert } = await import("@/lib/telegram");
            notifySystemAlert(
              `📌 <b>Email important</b>\nDe: ${email.from.slice(0, 60)}\nSujet: ${email.subject.slice(0, 80)}\n\n<i>Dans ta boîte Gmail — aucune action auto</i>`
            ).catch(() => {});
          }
          processed++;
          results.push({ email: email.fromEmail, intent: "BUSINESS_ALERT", emailAction: "keep", actionsPerformed: [] });
          continue;
        }

        // ── Supplier emails — keep in inbox, Telegram alert ───────────────────
        const isSupplier = SUPPLIER_KEYWORDS.some(k => text.includes(k));
        if (isSupplier) {
          await markAsRead(email.id);
          const { notifySystemAlert } = await import("@/lib/telegram");
          notifySystemAlert(
            `📦 <b>Email fournisseur reçu</b>\nDe: ${email.from.slice(0, 60)}\nSujet: ${email.subject.slice(0, 80)}\n\n<i>Dans ta boîte Gmail</i>`
          ).catch(() => {});
          processed++;
          results.push({ email: email.fromEmail, intent: "SUPPLIER", emailAction: "keep", actionsPerformed: [] });
          continue;
        }

        // ── Known spam — archive silently ──────────────────────────────────────
        if (KNOWN_SPAM_SENDERS.some(s => frm.includes(s))) {
          await archiveEmail(email.id);
          processed++;
          results.push({ email: email.fromEmail, intent: "SPAM", emailAction: "archive", actionsPerformed: [] });
          continue;
        }

        // ── TIER 3: Real email — AI processes it ───────────────────────────────
        const { reply, intent, actionsPerformed, emailAction } = await processEmailWithAgent(email);

        // Important emails go to approval flow — do NOT auto-reply
        if (intent === "IMPORTANT") {
          // Dedup — skip if already sent approval request for this gmail_id
          const { data: alreadyNotifiedImportant } = await supabaseAdmin
            .from("notified_emails").select("gmail_id").eq("gmail_id", email.id).single();

          if (!alreadyNotifiedImportant) {
            await supabaseAdmin.from("notified_emails").insert({ gmail_id: email.id });
            const fromName = email.from.split("<")[0].trim() || email.fromEmail;
            const metaPrefix = JSON.stringify({
              gmail_id: email.id,
              thread_id: email.threadId,
              subject: email.subject,
            });
            const { data: savedDraft } = await supabaseAdmin.from("figaro_messages").insert({
              from_name: fromName,
              from_email: email.fromEmail,
              message: `${metaPrefix}|||[EMAIL IMPORTANT] Sujet: ${email.subject}\n\n${email.body}`,
              ai_response: reply,
              escalated: true,
            }).select("id").single();

            if (savedDraft?.id) {
              sendEmailApprovalRequest({
                id: savedDraft.id,
                from_name: fromName,
                from_email: email.fromEmail,
                subject: email.subject,
                original_body: email.body,
                draft_response: reply,
              }).catch(() => {});
            }
          }

          // Keep email in inbox (unread = visible to Melynda); webhook archives after decision
          await markAsRead(email.id);
          processed++;
          results.push({ email: email.fromEmail, intent, emailAction: "keep", actionsPerformed });
          continue;
        }

        // Reply to client via Gmail (pas pour spam/delete)
        if (emailAction !== "delete") {
          await sendGmailReply({
            threadId: email.threadId,
            to: email.fromEmail,
            subject: email.subject,
            body: reply,
          });
        }

        // Escalade si plainte
        const isEscalated = intent === "COMPLAINT";
        if (isEscalated) {
          notifyEscalation({
            from_name: email.from.split("<")[0].trim() || email.fromEmail,
            from_email: email.fromEmail,
            message: `[Sujet: ${email.subject}]\n\n${email.body.slice(0, 300)}`,
            ai_response: reply,
            source: "email",
          }).catch(() => {});
          if (process.env.MELYNDA_PHONE) {
            sendSMS(
              process.env.MELYNDA_PHONE,
              `Figaro ✂️ — Email plainte de ${email.from}: "${email.subject}" → Suivi requis !`
            ).catch(() => {});
          }
        }

        // Save to figaro_messages
        await supabaseAdmin.from("figaro_messages").insert({
          from_name: email.from.split("<")[0].trim() || email.fromEmail,
          from_email: email.fromEmail,
          message: `[EMAIL] Sujet: ${email.subject}\n\n${email.body}`,
          ai_response: reply,
          escalated: isEscalated,
        });

        // Appliquer l'action email — SAFETY MODE: no auto-delete, archive at most
        if (emailAction === "delete" || emailAction === "archive") {
          await archiveEmail(email.id); // delete → archive only (safety)
        } else {
          await markAsRead(email.id); // keep = garder lu dans inbox
        }

        processed++;
        results.push({ email: email.fromEmail, intent, emailAction, actionsPerformed });
      } catch (err) {
        console.error(`Email processing error for ${email.fromEmail}:`, err);
      }
    }

    // Résumé Telegram — seulement si quelque chose d'intéressant s'est passé
    const urgents = results.filter(r => r.intent === "COMPLAINT");
    const importants = results.filter(r => r.intent === "IMPORTANT");
    const infos = results.filter(r => ["BOOK_APPOINTMENT", "CANCEL_BOOKING"].includes(r.intent));
    const silenced = results.filter(r => ["SILENT_ARCHIVE", "SPAM", "PAYMENT_NOTIF"].includes(r.intent));
    const hasAnythingWorthReporting = urgents.length || importants.length || infos.length;

    if (hasAnythingWorthReporting) {
      let summary = `✂️ <b>Figaro — ${processed} email(s)</b>\n\n`;

      if (urgents.length) {
        summary += `🚨 <b>URGENT (${urgents.length})</b>\n`;
        urgents.forEach(r => { summary += `• ${r.email}\n`; });
        summary += "\n";
      }
      if (importants.length) {
        summary += `⚠️ <b>En attente approbation (${importants.length})</b>\n`;
        importants.forEach(r => { summary += `• ${r.email}\n`; });
        summary += "\n";
      }
      if (infos.length) {
        summary += `✅ <b>Auto-traités (${infos.length})</b>\n`;
        infos.forEach(r => { summary += `• ${r.intent === "BOOK_APPOINTMENT" ? "RDV créé" : "Annulation"} — ${r.email}\n`; });
        summary += "\n";
      }
      if (silenced.length) {
        summary += `🔇 ${silenced.length} notif(s) tech archivées en silence`;
      }

      const { notifySystemAlert } = await import("@/lib/telegram");
      notifySystemAlert(summary).catch(() => {});
    }

    return NextResponse.json({ processed, results, silenced: silenced.length });
  });
}
