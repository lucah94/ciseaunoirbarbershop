import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import twilio from "twilio";

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || "ciseaunoir_messenger_2026";
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es l'assistant virtuel de Ciseau Noir Barbershop à Québec. Tu parles français et anglais.

SERVICES ET PRIX:
- Coupe adulte: 35$
- Coupe + Barbe: 45$
- Coupe enfant: 25$
- Barbe seulement: 20$
- Coupe + Lavage: 35$

HORAIRES:
- Mardi-Mercredi: 8h30-16h30
- Jeudi-Vendredi: 8h30-20h30
- Samedi: 8h30-16h30
- Dimanche-Lundi: Fermé

COORDONNÉES: 375 Boul. des Chutes, Québec | (418) 665-5703
RÉSERVATION EN LIGNE: ciseunoirbarbershop.com

COIFFEURS: Melynda et Diodis

Tu peux:
1. Répondre aux questions sur les services, prix, horaires
2. Réserver un rendez-vous (demande: nom, service, barber préféré, date/heure)
3. Annuler un rendez-vous (demande: nom + date)
4. Si le client est frustré, insistant ou a un problème complexe → utilise l'outil send_sms_alert

Sois chaleureux, professionnel et concis.`;

const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description: "Vérifier les disponibilités pour une date donnée, optionnellement pour un coiffeur spécifique",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        barber: { type: "string", description: "Nom du coiffeur (Melynda ou Diodis) — optionnel" },
      },
      required: ["date"],
    },
  },
  {
    name: "book_appointment",
    description: "Créer une nouvelle réservation dans le système",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nom complet du client" },
        phone: { type: "string", description: "Numéro de téléphone du client" },
        service: { type: "string", description: "Service choisi" },
        barber: { type: "string", description: "Coiffeur choisi (Melynda ou Diodis)" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        time: { type: "string", description: "Heure au format HH:MM" },
      },
      required: ["name", "phone", "service", "barber", "date", "time"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Annuler un rendez-vous existant",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nom du client" },
        date: { type: "string", description: "Date du rendez-vous au format YYYY-MM-DD" },
      },
      required: ["name", "date"],
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

async function handleToolCall(toolName: string, toolInput: Record<string, string>): Promise<string> {
  if (toolName === "check_availability") {
    const { date, barber } = toolInput;
    let query = supabase
      .from("bookings")
      .select("time, barber")
      .eq("date", date)
      .eq("status", "confirmed");
    if (barber) query = query.eq("barber", barber);
    const { data, error } = await query;
    if (error) return `Erreur lors de la vérification: ${error.message}`;

    const takenSlots = (data || []).map((b: { time: string; barber: string }) => `${b.barber} à ${b.time}`);
    if (takenSlots.length === 0) {
      return `Bonne nouvelle! La date ${date} est disponible. Aucune réservation confirmée${barber ? ` pour ${barber}` : ""}.`;
    }
    return `Créneaux occupés le ${date}: ${takenSlots.join(", ")}. Des plages horaires restent disponibles pour les autres horaires.`;
  }

  if (toolName === "book_appointment") {
    const { name, phone, service, barber, date, time } = toolInput;
    const prices: Record<string, number> = {
      "Coupe adulte": 35,
      "Coupe + Barbe": 45,
      "Coupe enfant": 25,
      "Barbe seulement": 20,
      "Coupe + Lavage": 35,
    };
    const price = prices[service] || 35;

    const { data, error } = await supabase
      .from("bookings")
      .insert([{ client_name: name, client_phone: phone, service, barber, date, time, price, status: "confirmed" }])
      .select()
      .single();
    if (error) return `Erreur lors de la réservation: ${error.message}`;
    return `Réservation confirmée! ${name}, ${service} avec ${barber} le ${date} à ${time}. ID: ${data.id}`;
  }

  if (toolName === "cancel_appointment") {
    const { name, date } = toolInput;
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", date)
      .eq("status", "confirmed")
      .ilike("client_name", `%${name}%`);

    if (!bookings || bookings.length === 0) {
      return `Aucune réservation confirmée trouvée pour ${name} le ${date}.`;
    }

    const booking = bookings[0];
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return `Réservation annulée pour ${booking.client_name} le ${date} à ${booking.time} avec ${booking.barber}.`;
  }

  if (toolName === "send_sms_alert") {
    const { message } = toolInput;
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
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
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
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
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
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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

// POST: Receive and handle incoming messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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
