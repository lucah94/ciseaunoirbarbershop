import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import twilio from "twilio";
import crypto from "crypto";
export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN!;
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";

function getSystemPrompt(barbers: { name: string; schedule: DaySched }[]): string {
  const now = new Date();
  const today = now.toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }); // YYYY-MM-DD
  const dayName = now.toLocaleDateString("fr-CA", { weekday: "long", timeZone: "America/Toronto" });

  const LBL: Record<string, string> = { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam", sun: "Dim" };
  const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const barbersText = barbers.length
    ? barbers.map(b => {
        const days = ORDER.filter(k => b.schedule?.[k]).map(k => `${LBL[k]} ${b.schedule![k]!.open}-${b.schedule![k]!.close}`);
        return `- ${b.name}: ${days.length ? days.join(", ") : "horaire à confirmer"}`;
      }).join("\n")
    : "- (voir le site pour les disponibilités)";

  return `Tu es l'assistant virtuel de Ciseau Noir Barbershop à Québec. Tu parles français et anglais.
Aujourd'hui: ${dayName} ${today}.

SERVICES ET PRIX:
- Coupe + Lavage: 35$ (45 min)
- Coupe + Barbe + Lavage (rasage lame & serviette chaude): 50$ (60 min)
- Service Premium (coupe, rasage, serviette chaude & exfoliant): 75$ (75 min)
- Rasage / Barbe: 25$ (30 min)
- Tarif Étudiant (preuve requise): 30$ (45 min)
- Étudiant / Enfant (12 ans et moins): 30$ (30 min)

COIFFEURS ET HORAIRES (à jour):
${barbersText}
Fermé dimanche et lundi.

COORDONNÉES: 375 Boul. des Chutes, Québec | (418) 665-5703
RÉSERVATION EN LIGNE: https://ciseaunoirbarbershop.com/booking

INSTRUCTIONS:
1. Réponds à TOUTES les questions (services, prix, horaires, coiffeurs, localisation) comme un pro. Ton québécois chaleureux, tutoie le client, garde tes réponses COURTES (c'est Messenger).
2. Pour les disponibilités, utilise TOUJOURS check_availability avec la/les date(s) ET le service choisi (les créneaux dépendent de la durée du service). Propose les vraies heures libres seulement.
3. Le client peut réserver directement dans le chat: demande nom, téléphone, EMAIL (obligatoire), service, coiffeur (ou n'importe lequel de dispo), date et heure, PUIS utilise book_appointment.
4. Sinon offre le lien: "Tu peux aussi réserver directement ici 👉 https://ciseaunoirbarbershop.com/booking"
5. Si pas de préférence de date, vérifie les 3 prochains jours ouvrables.
6. Si le client est frustré ou cas complexe → send_sms_alert à l'équipe.
7. N'invente JAMAIS une disponibilité — base-toi uniquement sur check_availability.`;
}

const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description: "Vérifier les créneaux disponibles pour une date donnée. Retourne les heures libres. Peut vérifier plusieurs dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        dates: { type: "array", items: { type: "string" }, description: "Dates au format YYYY-MM-DD (peut en vérifier plusieurs)" },
        barber: { type: "string", description: "Nom du coiffeur — optionnel (tous les coiffeurs si vide)" },
        service: { type: "string", description: "Le service choisi (ex: 'Coupe + Lavage') — important, les créneaux dépendent de sa durée" },
      },
      required: ["dates"],
    },
  },
  {
    name: "book_appointment",
    description: "Créer une réservation quand le client donne toutes les infos (nom, téléphone, email, service, coiffeur, date, heure)",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nom complet du client" },
        phone: { type: "string", description: "Numéro de téléphone du client" },
        email: { type: "string", description: "Adresse email du client" },
        service: { type: "string", description: "Service choisi" },
        barber: { type: "string", description: "Coiffeur choisi (Melynda)" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        time: { type: "string", description: "Heure au format HH:MM" },
      },
      required: ["name", "phone", "email", "service", "barber", "date", "time"],
    },
  },
  {
    name: "send_sms_alert",
    description: "Envoyer une alerte SMS à l'équipe Ciseau Noir (utiliser si le client est frustré ou a un problème complexe)",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message d'alerte à envoyer" },
      },
      required: ["message"],
    },
  },
];

// Barbiers + dispos DYNAMIQUES (depuis la table barbers) — pas de noms en dur.
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
type DaySched = Record<string, { open: string; close: string } | null>;

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const minutesOf = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

// Durée d'un service en minutes (pour calculer/empiler les créneaux)
function serviceDuration(service: string): number {
  const s = (service || "").toLowerCase();
  if (s.includes("premium") || s.includes("forfait")) return 75;
  if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
  if (s.includes("enfant")) return 30;
  if (s.includes("coupe") || s.includes("lavage") || s.includes("étudiant") || s.includes("etudiant") || s.includes("student")) return 45;
  return 30;
}

// Départs aux 15 min; le RDV (durationMin) doit finir au plus 15 min après la fermeture.
function genSlots(open: string, close: string, durationMin: number): string[] {
  const out: string[] = [];
  let cur = minutesOf(open);
  const end = minutesOf(close) - durationMin + 15;
  while (cur <= end) { out.push(`${Math.floor(cur / 60)}:${String(cur % 60).padStart(2, "0")}`); cur += 15; }
  return out;
}

async function getActiveBarbers(): Promise<{ name: string; schedule: DaySched }[]> {
  const { data } = await supabase.from("barbers").select("name, schedule, active").eq("active", true).order("created_at", { ascending: true });
  return (data || []) as { name: string; schedule: DaySched }[];
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long" });
}

async function handleToolCall(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  if (toolName === "check_availability") {
    const dates = toolInput.dates as string[];
    const barberFilter = toolInput.barber ? norm(toolInput.barber as string) : undefined;
    const dur = serviceDuration((toolInput.service as string) || "");
    const barbers = await getActiveBarbers();
    const results: string[] = [];

    for (const date of dates) {
      const dayName = getDayName(date);
      const dayKey = DAY_KEYS[new Date(date + "T12:00:00").getDay()];

      const { data: bookings } = await supabase
        .from("bookings")
        .select("time, end_time, barber, service")
        .eq("date", date)
        .neq("status", "cancelled");

      const lines: string[] = [];
      for (const b of barbers) {
        if (barberFilter && !norm(b.name).includes(barberFilter)) continue;
        const day = b.schedule?.[dayKey];
        if (!day) { lines.push(`${b.name}: ne travaille pas ce jour`); continue; }

        const booked = (bookings || []).filter(x => norm(x.barber || "") === norm(b.name));
        const free = genSlots(day.open, day.close, dur).filter(t => {
          const start = minutesOf(t), slotEnd = start + dur;
          return !booked.some(x => {
            const bStart = minutesOf(x.time || "0:0");
            const bEnd = x.end_time ? minutesOf(x.end_time) : bStart + serviceDuration(x.service || "");
            return start < bEnd && slotEnd > bStart;
          });
        });
        lines.push(free.length ? `${b.name}: ${free.join(", ")} (${free.length} libres)` : `${b.name}: COMPLET`);
      }
      results.push(`${dayName} ${date}:\n${lines.join("\n") || "Aucun barbier ce jour"}`);
    }
    return results.join("\n\n");
  }

  if (toolName === "book_appointment") {
    const { name, phone, email, service, barber, date, time } = toolInput as Record<string, string>;
    const prices: Record<string, number> = {
      "Coupe + Lavage": 35,
      "Coupe + Barbe + Lavage": 50,
      "Coupe + Rasage Lame": 50,
      "Service Premium": 75,
      "Rasage / Barbe": 25,
      "Tarif Étudiant": 30,
      "Étudiant / Enfant": 30,
    };
    const price = prices[service] || 35;
    // Passe par /api/bookings → déclenche email + SMS + Telegram (la totale), pas juste un insert
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
      const res = await fetch(`${base}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: name, client_phone: phone, client_email: email, service, barber, date, time, price, source: "messenger" }),
      });
      const data = await res.json();
      if (!res.ok) return `Erreur lors de la réservation: ${data.error || ("HTTP " + res.status)}`;
      return `Réservation confirmée! ${name}, ${service} avec ${barber} le ${date} à ${time}.`;
    } catch (e) {
      return `Erreur lors de la réservation: ${String(e)}`;
    }
  }

  if (toolName === "send_sms_alert") {
    const { message } = toolInput as Record<string, string>;
    try {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: process.env.LUCA_PHONE || process.env.MELYNDA_PHONE || "+18147403894",
        body: `⚠️ Messenger: ${message}`,
      });
      return "Alerte SMS envoyée à l'équipe.";
    } catch (e) {
      return `Erreur SMS: ${String(e)}`;
    }
  }

  return "Outil inconnu.";
}

async function sendMessengerMessage(recipientId: string, text: string) {
  // Check if the reply contains the booking URL
  const bookingUrl = "https://ciseaunoirbarbershop.com/booking";
  const hasBookingLink = text.includes(bookingUrl);

  // Send the text (remove the URL from text if we'll send a button)
  const cleanText = hasBookingLink ? text.replace(bookingUrl, "").replace(/👉\s*$/, "").trim() : text;

  const sendRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: cleanText },
    }),
  });
  if (!sendRes.ok) {
    const err = await sendRes.text().catch(() => "");
    // Si ça échoue ici (souvent token Facebook expiré), on le verra dans les logs Vercel
    console.error(`[Messenger] Échec envoi FB (HTTP ${sendRes.status}) — token expiré? →`, err.slice(0, 300));
  }

  // Send a clickable button for booking
  if (hasBookingLink) {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "Réserve ton rendez-vous en ligne! ✂️",
              buttons: [
                {
                  type: "web_url",
                  url: bookingUrl,
                  title: "Réserver maintenant",
                },
              ],
            },
          },
        },
      }),
    });
  }
}

async function processMessageWithClaude(senderId: string, userMessage: string): Promise<string> {
  // Load or create conversation
  const { data: conv } = await supabase
    .from("messenger_conversations")
    .select("*")
    .eq("sender_id", senderId)
    .single();

  const existingMessages: Array<{ role: string; content: string }> = conv?.messages || [];
  const last20 = existingMessages.slice(-20);

  // Build messages for Claude
  const messages: Anthropic.MessageParam[] = last20.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  messages.push({ role: "user", content: userMessage });

  // Barbiers actifs (dynamique) pour le prompt
  const barbers = await getActiveBarbers();
  const systemPrompt = getSystemPrompt(barbers);

  // Agentic loop
  let response = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 1024,
    system: systemPrompt,
    tools: CLAUDE_TOOLS,
    messages,
  });

  const loopMessages: Anthropic.MessageParam[] = [...messages];

  // Boucle agentique robuste : gère PLUSIEURS actions par tour + garde-fou anti-boucle (max 6)
  let guard = 0;
  while (response.stop_reason === "tool_use" && guard < 6) {
    guard++;
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const r = await handleToolCall(tu.name, tu.input as Record<string, unknown>);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: r });
    }

    loopMessages.push({ role: "assistant", content: response.content });
    loopMessages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: MODELS.SMART,
      max_tokens: 1024,
      system: systemPrompt,
      tools: CLAUDE_TOOLS,
      messages: loopMessages,
    });
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const assistantReply = textBlock?.text || "Désolé, je n'ai pas pu traiter votre message.";

  // Save updated conversation
  const updatedMessages = [
    ...last20,
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantReply },
  ];

  if (conv) {
    await supabase
      .from("messenger_conversations")
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq("sender_id", senderId);
  } else {
    await supabase.from("messenger_conversations").insert([
      {
        sender_id: senderId,
        messages: updatedMessages,
        customer_profile: {},
      },
    ]);
  }

  return assistantReply;
}

// GET: Facebook webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Verify Facebook webhook signature
function verifyFacebookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.FACEBOOK_APP_SECRET) return false;
  const expectedSig = "sha256=" + crypto.createHmac("sha256", process.env.FACEBOOK_APP_SECRET).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

// POST: Receive and handle incoming messages
// BOT DÉSACTIVÉ — à réactiver quand le nouveau site est en ligne
const BOT_ENABLED = true;

export async function POST(req: NextRequest) {
  if (!BOT_ENABLED) {
    return NextResponse.json({ ok: true, status: "bot_disabled" });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifyFacebookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

    if (body.object !== "page") {
      return NextResponse.json({ error: "Not a page event" }, { status: 400 });
    }

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (!senderId) continue;

        // Only process text messages
        if (!event.message?.text) continue;
        // Ignore echo messages from the page itself
        if (event.message?.is_echo) continue;

        const userText: string = event.message.text;

        // Update sender name if available
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/${senderId}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`
          );
          const profile = await profileRes.json();
          if (profile.first_name) {
            const senderName = `${profile.first_name} ${profile.last_name || ""}`.trim();
            await supabase
              .from("messenger_conversations")
              .upsert({ sender_id: senderId, sender_name: senderName }, { onConflict: "sender_id" });
          }
        } catch {
          // Profile fetch failure is non-critical
        }

        const reply = await processMessageWithClaude(senderId, userText);
        await sendMessengerMessage(senderId, reply);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Messenger webhook error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
