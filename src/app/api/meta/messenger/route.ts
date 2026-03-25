import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import twilio from "twilio";
import crypto from "crypto";

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN!;
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function getSystemPrompt() {
  const now = new Date();
  const today = now.toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }); // YYYY-MM-DD
  const dayName = now.toLocaleDateString("fr-CA", { weekday: "long", timeZone: "America/Toronto" });

  return `Tu es l'assistant virtuel de Ciseau Noir Barbershop à Québec. Tu parles français et anglais.
Aujourd'hui: ${dayName} ${today}.

SERVICES ET PRIX:
- Coupe + Lavage: 35$ (45 min)
- Coupe + Rasage Lame & Serviette Chaude: 50$ (60 min)
- Service Premium (coupe, rasage, serviette chaude & exfoliant): 75$ (75 min)
- Rasage / Barbe: 25$ (30 min)
- Tarif Étudiant (preuve requise): 30$ (45 min)

HORAIRES:
- Mardi-Mercredi: 8h30-16h30
- Jeudi-Vendredi: 8h30-20h30
- Samedi: 8h30-16h30
- Dimanche-Lundi: Fermé

COIFFEURS ET DISPONIBILITÉS:
- Melynda: Mardi à Samedi. Mar/Mer/Sam: 8h30-16h30. Jeu/Ven: 8h30-20h30.
- Diodis: Vendredi 15h00-20h30 et Samedi 9h00-16h30 seulement.

COORDONNÉES: 375 Boul. des Chutes, Québec | (418) 665-5703
RÉSERVATION EN LIGNE: ciseaunoirbarbershop.com

LIEN DE RÉSERVATION: https://ciseau-noir.vercel.app/booking

INSTRUCTIONS IMPORTANTES:
1. Réponds aux questions sur les services, prix, horaires, coiffeurs.
2. Quand un client veut un rendez-vous, vérifie les dispos avec check_availability.
3. Propose le lien pour réserver en ligne: "Tu peux aussi réserver directement ici 👉 https://ciseau-noir.vercel.app/booking"
4. Si le client préfère réserver directement par le chat, c'est possible! Demande: nom, téléphone, email, service, coiffeur, date et heure. Puis utilise book_appointment.
5. IMPORTANT: demande TOUJOURS l'email du client avant de réserver.
6. Si le client n'a pas de préférence de date, vérifie les 3 prochains jours ouvrables.
7. Si le client est frustré ou a un problème complexe → utilise send_sms_alert.
8. Sois chaleureux, naturel et québécois dans ton ton. Tutoie le client.
9. Garde tes réponses courtes et directes — c'est Messenger, pas un email.`;
}

const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description: "Vérifier les créneaux disponibles pour une date donnée. Retourne les heures libres. Peut vérifier plusieurs dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        dates: { type: "array", items: { type: "string" }, description: "Dates au format YYYY-MM-DD (peut en vérifier plusieurs)" },
        barber: { type: "string", description: "Nom du coiffeur (Melynda ou Diodis) — optionnel" },
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
        barber: { type: "string", description: "Coiffeur choisi (Melynda ou Diodis)" },
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

// Schedule constants
const MELYNDA_SHORT = ["8:30","9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00"];
const MELYNDA_LONG  = ["8:30","9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"];
const DIODIS_FRI    = ["15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"];
const DIODIS_SAT    = ["9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00"];

function getSlotsForBarber(barber: string, dateStr: string): string[] {
  const day = new Date(dateStr + "T12:00:00").getDay();
  if ([0, 1].includes(day)) return []; // Fermé dim/lun
  if (barber.toLowerCase() === "diodis") {
    if (day === 5) return DIODIS_FRI;
    if (day === 6) return DIODIS_SAT;
    return [];
  }
  // Melynda
  if (day === 4 || day === 5) return MELYNDA_LONG;
  return MELYNDA_SHORT;
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long" });
}

async function handleToolCall(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  if (toolName === "check_availability") {
    const dates = toolInput.dates as string[];
    const barberFilter = toolInput.barber as string | undefined;
    const results: string[] = [];

    for (const date of dates) {
      const dayName = getDayName(date);
      const day = new Date(date + "T12:00:00").getDay();

      if ([0, 1].includes(day)) {
        results.push(`${dayName} ${date}: FERMÉ (dimanche/lundi)`);
        continue;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("time, barber")
        .eq("date", date)
        .eq("status", "confirmed");

      const bookedSet = new Set((bookings || []).map((b: { time: string; barber: string }) => `${b.barber}-${b.time}`));
      const barbers = barberFilter ? [barberFilter] : ["Melynda", "Diodis"];
      const barberResults: string[] = [];

      for (const barber of barbers) {
        const allSlots = getSlotsForBarber(barber, date);
        if (allSlots.length === 0) {
          barberResults.push(`${barber}: ne travaille pas ce jour`);
          continue;
        }
        const available = allSlots.filter(t => !bookedSet.has(`${barber}-${t}`));
        if (available.length === 0) {
          barberResults.push(`${barber}: COMPLET`);
        } else {
          barberResults.push(`${barber}: ${available.join(", ")} (${available.length} créneaux libres)`);
        }
      }
      results.push(`${dayName} ${date}:\n${barberResults.join("\n")}`);
    }
    return results.join("\n\n");
  }

  if (toolName === "book_appointment") {
    const { name, phone, email, service, barber, date, time } = toolInput as Record<string, string>;
    const prices: Record<string, number> = {
      "Coupe + Lavage": 35,
      "Coupe + Rasage Lame": 50,
      "Service Premium": 75,
      "Rasage / Barbe": 25,
      "Tarif Étudiant": 30,
    };
    const price = prices[service] || 35;

    const { data, error } = await supabase
      .from("bookings")
      .insert([{ client_name: name, client_phone: phone, client_email: email, service, barber, date, time, price, status: "confirmed" }])
      .select()
      .single();
    if (error) return `Erreur lors de la réservation: ${error.message}`;
    return `Réservation confirmée! ${name}, ${service} avec ${barber} le ${date} à ${time}. ID: ${data.id}`;
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
        to: "+18147403894",
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
  const bookingUrl = "https://ciseau-noir.vercel.app/booking";
  const hasBookingLink = text.includes(bookingUrl);

  // Send the text (remove the URL from text if we'll send a button)
  const cleanText = hasBookingLink ? text.replace(bookingUrl, "").replace(/👉\s*$/, "").trim() : text;

  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: cleanText },
    }),
  });

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

  // Agentic loop
  let response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: getSystemPrompt(),
    tools: CLAUDE_TOOLS,
    messages,
  });

  const loopMessages: Anthropic.MessageParam[] = [...messages];

  while (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUseBlock) break;

    const toolResult = await handleToolCall(
      toolUseBlock.name,
      toolUseBlock.input as Record<string, string>
    );

    loopMessages.push({ role: "assistant", content: response.content });
    loopMessages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: toolResult }],
    });

    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: getSystemPrompt(),
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
const BOT_ENABLED = false;

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
