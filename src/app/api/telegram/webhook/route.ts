import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendGmailReply, archiveEmail } from "@/lib/gmail";
import { getUpcomingHolidays, isHoliday } from "@/lib/holidays-qc";
import Anthropic from "@anthropic-ai/sdk";

const TELEGRAM_API = "https://api.telegram.org/bot";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getToken() { return process.env.TELEGRAM_BOT_TOKEN || ""; }

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}${getToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

async function answerCallback(id: string): Promise<void> {
  await fetch(`${TELEGRAM_API}${getToken()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

async function editMessage(chatId: number, messageId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}${getToken()}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  });
}

function extractGmailMeta(msg: string) {
  try {
    const meta = JSON.parse(msg.split("|||")[0]);
    return { gmailId: meta.gmail_id || "", threadId: meta.thread_id || "", subject: meta.subject || "" };
  } catch { return { gmailId: "", threadId: "", subject: "" }; }
}

// Strip bot username from group messages (e.g. "@CiseauNoirOps_bot RDV de demain" → "RDV de demain")
function stripBotMention(text: string): string {
  return text.replace(/^@\S+\s*/, "").trim();
}

// ── Memory ────────────────────────────────────────────────────────────────────
async function loadHistory(chatId: number): Promise<Anthropic.MessageParam[]> {
  try {
    const { data } = await supabaseAdmin
      .from("telegram_conversations")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data?.length) return [];
    return data.reverse().map(r => ({ role: r.role as "user" | "assistant", content: r.content }));
  } catch { return []; }
}

async function saveHistory(chatId: number, role: "user" | "assistant", content: string): Promise<void> {
  try {
    await supabaseAdmin.from("telegram_conversations").insert({ chat_id: chatId, role, content });
    // Keep only last 40 messages per chat
    const { data } = await supabaseAdmin
      .from("telegram_conversations")
      .select("id")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .range(40, 9999);
    if (data?.length) {
      await supabaseAdmin.from("telegram_conversations").delete().in("id", data.map(d => d.id));
    }
  } catch { /* silent */ }
}

// ── Date helpers (toujours en heure de Québec — America/Toronto) ──────────────
const TZ = "America/Toronto";

function todayQC(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function tomorrowQC(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function getWeekBounds(offsetWeeks = 0): { start: string; end: string; label: string } {
  // Calcule lundi/dimanche en heure QC
  const nowQC = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const dow = nowQC.getDay(); // 0=dim
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(nowQC);
  monday.setDate(nowQC.getDate() + daysToMonday + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const label = offsetWeeks === 0 ? "cette semaine"
    : offsetWeeks === 1 ? "la semaine prochaine"
    : offsetWeeks === -1 ? "la semaine passée"
    : `semaine du ${fmt(monday)}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

function parseDate(input: string): string {
  if (input === "demain") return tomorrowQC();
  if (input === "aujourd'hui" || input === "today") return todayQC();
  return input; // assume YYYY-MM-DD
}

// ── Tool execution ────────────────────────────────────────────────────────────
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {

  // ── get_bookings ─────────────────────────────────────────────────────────────
  if (name === "get_bookings") {
    const barber = input.barber as string | undefined;
    const dateInput = input.date as string | undefined;
    const period = (input.period as string | undefined) || "today";

    let startDate: string, endDate: string, label: string;

    if (dateInput) {
      startDate = endDate = parseDate(dateInput); label = startDate;
    } else if (period === "today") {
      startDate = endDate = todayQC(); label = "aujourd'hui";
    } else if (period === "tomorrow") {
      startDate = endDate = tomorrowQC(); label = "demain";
    } else if (period === "this_week") {
      const w = getWeekBounds(0); startDate = w.start; endDate = w.end; label = w.label;
    } else if (period === "next_week") {
      const w = getWeekBounds(1); startDate = w.start; endDate = w.end; label = w.label;
    } else if (period === "last_week") {
      const w = getWeekBounds(-1); startDate = w.start; endDate = w.end; label = w.label;
    } else {
      startDate = endDate = todayQC(); label = "aujourd'hui";
    }

    let query = supabaseAdmin
      .from("bookings")
      .select("id, client_name, client_phone, service, barber, date, time, status, price")
      .gte("date", startDate).lte("date", endDate)
      .neq("status", "cancelled")
      .order("date").order("time");

    if (barber) query = query.ilike("barber", `%${barber}%`);
    const { data } = await query;
    if (!data?.length) return `Aucun RDV ${barber ? `pour ${barber} ` : ""}${label}.`;

    const byBarber: Record<string, typeof data> = {};
    for (const b of data) {
      if (!byBarber[b.barber]) byBarber[b.barber] = [];
      byBarber[b.barber].push(b);
    }
    let result = `RDV ${label} — ${data.length} total\n\n`;
    for (const [b, bkgs] of Object.entries(byBarber)) {
      result += `${b} (${bkgs.length})\n`;
      for (const bk of bkgs) {
        result += `  [${bk.id.slice(0,8)}] ${bk.date} ${bk.time} — ${bk.client_name} | ${bk.service}${bk.price ? ` | ${bk.price}$` : ""} | ${bk.client_phone}\n`;
      }
      result += "\n";
    }
    return result.trim();
  }

  // ── get_revenue ──────────────────────────────────────────────────────────────
  if (name === "get_revenue") {
    const period = (input.period as string) || "this_week";
    const today = new Date().toISOString().slice(0, 10);
    let startDate: string, endDate: string, label: string;

    if (period === "today") { startDate = endDate = today; label = "aujourd'hui"; }
    else if (period === "this_week") { const w = getWeekBounds(0); startDate = w.start; endDate = w.end; label = w.label; }
    else if (period === "last_week") { const w = getWeekBounds(-1); startDate = w.start; endDate = w.end; label = w.label; }
    else if (period === "this_month") {
      const qc = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
      startDate = `${qc.getFullYear()}-${String(qc.getMonth()+1).padStart(2,"0")}-01`;
      endDate = todayQC(); label = "ce mois";
    } else { startDate = endDate = todayQC(); label = "aujourd'hui"; }

    const { data } = await supabaseAdmin
      .from("bookings").select("price, barber, status")
      .gte("date", startDate).lte("date", endDate)
      .in("status", ["confirmed", "completed"]);

    if (!data?.length) return `Aucun revenu enregistré ${label}.`;

    const total = data.reduce((s, b) => s + (b.price || 0), 0);
    const byBarber: Record<string, { count: number; revenue: number }> = {};
    for (const b of data) {
      if (!byBarber[b.barber]) byBarber[b.barber] = { count: 0, revenue: 0 };
      byBarber[b.barber].count++;
      byBarber[b.barber].revenue += b.price || 0;
    }
    let result = `Revenus ${label} — <b>${total}$</b> total | ${data.length} RDV\n\n`;
    for (const [barber, stats] of Object.entries(byBarber)) {
      result += `${barber}: ${stats.count} RDV — ${stats.revenue}$\n`;
    }
    return result.trim();
  }

  // ── search_client ─────────────────────────────────────────────────────────────
  if (name === "search_client") {
    const name = input.name as string;
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, client_name, client_phone, client_email, service, barber, date, time, status")
      .ilike("client_name", `%${name}%`)
      .order("date", { ascending: false }).limit(5);
    if (!data?.length) return `Aucun client trouvé pour "${name}".`;
    return data.map(b =>
      `[${b.id.slice(0,8)}] ${b.client_name} | ${b.client_phone || b.client_email || "—"}\n  ${b.date} ${b.time} — ${b.service} avec ${b.barber} (${b.status})`
    ).join("\n\n");
  }

  // ── cancel_booking ───────────────────────────────────────────────────────────
  if (name === "cancel_booking") {
    const id = input.id as string;
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("client_name, service, barber, date, time")
      .single();
    if (error || !data) return `Impossible de trouver le RDV [${id}]. Vérifie l'ID.`;
    return `✅ RDV annulé : ${data.client_name} — ${data.service} avec ${data.barber}, ${data.date} à ${data.time}`;
  }

  // ── add_expense ──────────────────────────────────────────────────────────────
  if (name === "add_expense") {
    const description = input.description as string;
    const amount = Number(input.amount);
    const category = (input.category as string) || "Autre";
    const date = (input.date as string) || new Date().toISOString().slice(0, 10);

    const validCategories = ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"];
    const finalCategory = validCategories.includes(category) ? category : "Autre";

    const { error } = await supabaseAdmin
      .from("expenses")
      .insert({ description, amount, category: finalCategory, date });
    if (error) return `Erreur lors de l'ajout de la dépense : ${error.message}`;
    return `✅ Dépense ajoutée : ${description} — ${amount}$ (${finalCategory}) le ${date}`;
  }

  // ── block_barber_day ─────────────────────────────────────────────────────────
  if (name === "block_barber_day") {
    const barber = input.barber as string;
    const date = parseDate(input.date as string);
    const reason = (input.reason as string) || null;

    // Check if already blocked
    const { data: existing } = await supabaseAdmin
      .from("barber_blocks").select("id").eq("barber", barber).eq("date", date);
    if (existing?.length) return `⚠️ ${barber} est déjà bloqué le ${date}.`;

    const { error } = await supabaseAdmin
      .from("barber_blocks")
      .insert({ barber, date, reason });
    if (error) return `Erreur : ${error.message}`;
    return `✅ Journée bloquée : ${barber} — ${date}${reason ? ` (${reason})` : ""}`;
  }

  // ── unblock_barber_day ───────────────────────────────────────────────────────
  if (name === "unblock_barber_day") {
    const barber = input.barber as string;
    const date = parseDate(input.date as string);

    const { data, error } = await supabaseAdmin
      .from("barber_blocks").delete().eq("barber", barber).eq("date", date).select();
    if (error) return `Erreur : ${error.message}`;
    if (!data?.length) return `Aucun blocage trouvé pour ${barber} le ${date}.`;
    return `✅ Blocage retiré : ${barber} est maintenant disponible le ${date}`;
  }

  // ── get_pending_emails ───────────────────────────────────────────────────────
  if (name === "get_pending_emails") {
    const { data } = await supabaseAdmin
      .from("figaro_messages")
      .select("id, from_name, from_email, message, created_at")
      .eq("escalated", true)
      .order("created_at", { ascending: false }).limit(5);
    if (!data?.length) return "Aucun email en attente d'approbation. ✅";
    return data.map(d =>
      `• [${(d.id as string).slice(0,8)}] ${d.from_name} <${d.from_email}>\n  ${String(d.message).replace(/^.*\|\|\|/, "").slice(0, 100)}...`
    ).join("\n\n");
  }

  // ── get_blocks ───────────────────────────────────────────────────────────────
  if (name === "get_blocks") {
    const barber = input.barber as string | undefined;
    let query = supabaseAdmin
      .from("barber_blocks").select("barber, date, reason")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date").limit(10);
    if (barber) query = query.ilike("barber", `%${barber}%`);
    const { data } = await query;
    if (!data?.length) return "Aucune journée bloquée à venir.";
    return data.map(b => `${b.barber} — ${b.date}${b.reason ? ` (${b.reason})` : ""}`).join("\n");
  }

  // ── get_holidays ─────────────────────────────────────────────────────────────
  if (name === "get_holidays") {
    const days = (input.days as number) || 30;
    const upcoming = getUpcomingHolidays(days);
    if (!upcoming.length) return `Aucun jour férié dans les ${days} prochains jours.`;
    return `Jours fériés QC (${days} prochains jours) :\n\n` +
      upcoming.map(h => `${h.emoji} ${h.date} — ${h.name}`).join("\n");
  }

  // ── set_reminder ─────────────────────────────────────────────────────────────
  if (name === "set_reminder") {
    const message = input.message as string;
    const remindAt = input.remind_at as string; // ISO datetime ou "YYYY-MM-DD HH:MM"
    const chatIdReminder = input.chat_id as number;

    // Normalise en ISO
    let dt: string;
    if (remindAt.includes("T")) {
      dt = remindAt;
    } else if (remindAt.includes(" ")) {
      dt = remindAt.replace(" ", "T") + ":00";
    } else {
      dt = remindAt + "T00:00:00";
    }

    const { error } = await supabaseAdmin.from("reminders").insert({
      chat_id: chatIdReminder,
      message,
      remind_at: dt,
      done: false,
    });
    if (error) return `Erreur : ${error.message}`;

    const label = new Date(dt).toLocaleString("fr-CA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `⏰ Reminder créé : "${message}" → ${label}`;
  }

  return "Outil inconnu.";
}

// ── Conversation handler ──────────────────────────────────────────────────────
async function handleConversation(chatId: number, userMessage: string): Promise<void> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayLabel = today.toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const history = await loadHistory(chatId);
  await saveHistory(chatId, "user", userMessage);

  const systemPrompt = `Tu es Figaro ✂️, l'assistant IA de Ciseau Noir Barbershop à Québec.
Tu parles avec Melynda (propriétaire) ou Luca (admin) via Telegram.
Réponds en français québécois, court et direct. Max 5 lignes sauf si on demande une liste.
Tu retiens toute la conversation (mémoire persistante).

AUJOURD'HUI: ${todayLabel} (${todayStr})

OUTILS DISPONIBLES:
• get_bookings — RDV (period: today/tomorrow/this_week/next_week/last_week, barber, date YYYY-MM-DD)
• get_revenue — revenus (period: today/this_week/last_week/this_month)
• search_client — cherche un client par nom
• cancel_booking — annule un RDV (besoin de l'ID sur 8 chars ex: [abc12345])
• add_expense — ajoute une dépense (description, amount, category, date)
• block_barber_day — bloque une journée pour un barbier (barber, date, reason optionnel)
• unblock_barber_day — retire un blocage (barber, date)
• get_blocks — journées bloquées à venir (barber optionnel)
• get_pending_emails — emails en attente d'approbation
• get_holidays — prochains jours fériés QC (days optionnel, défaut 30)
• set_reminder — crée un rappel (message, remind_at "YYYY-MM-DD HH:MM", chat_id=${chatId})

RÈGLES:
- Utilise TOUJOURS les outils pour les données — ne devine jamais les chiffres
- Pour annuler un RDV, utilise d'abord search_client ou get_bookings pour trouver l'ID
- Pour bloquer un jour, confirme toujours avec le nom exact du barbier (Melynda ou Diodis)
- Les catégories de dépenses valides: Fournitures, Équipement, Loyer, Marketing, Employés, Services, Autre
- Pour set_reminder: convertis "dans 2h" / "à 15h" / "demain matin" en datetime exact YYYY-MM-DD HH:MM
- Si l'heure d'un reminder est ambiguë, demande avant de créer`;

  const tools: Anthropic.Tool[] = [
    {
      name: "get_bookings",
      description: "Retourne les RDV pour une période et/ou un barbier",
      input_schema: {
        type: "object" as const,
        properties: {
          period: { type: "string", enum: ["today", "tomorrow", "this_week", "next_week", "last_week"] },
          barber: { type: "string", description: "Nom du barbier (Melynda ou Diodis)" },
          date: { type: "string", description: "Date spécifique YYYY-MM-DD ou 'demain'" },
        },
        required: [],
      },
    },
    {
      name: "get_revenue",
      description: "Calcule les revenus pour une période",
      input_schema: {
        type: "object" as const,
        properties: {
          period: { type: "string", enum: ["today", "this_week", "last_week", "this_month"] },
        },
        required: ["period"],
      },
    },
    {
      name: "search_client",
      description: "Cherche un client par nom — retourne ses RDV récents avec les IDs",
      input_schema: {
        type: "object" as const,
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    {
      name: "cancel_booking",
      description: "Annule un RDV par son ID (les 8 premiers chars de l'UUID suffisent)",
      input_schema: {
        type: "object" as const,
        properties: { id: { type: "string", description: "ID du RDV (UUID complet ou 8 premiers chars)" } },
        required: ["id"],
      },
    },
    {
      name: "add_expense",
      description: "Ajoute une dépense dans la comptabilité",
      input_schema: {
        type: "object" as const,
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          category: { type: "string", enum: ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"] },
          date: { type: "string", description: "YYYY-MM-DD, défaut aujourd'hui" },
        },
        required: ["description", "amount"],
      },
    },
    {
      name: "block_barber_day",
      description: "Bloque une journée pour un barbier (empêche les réservations)",
      input_schema: {
        type: "object" as const,
        properties: {
          barber: { type: "string", description: "Melynda ou Diodis" },
          date: { type: "string", description: "YYYY-MM-DD ou 'demain'" },
          reason: { type: "string", description: "Raison optionnelle (vacances, maladie, etc.)" },
        },
        required: ["barber", "date"],
      },
    },
    {
      name: "unblock_barber_day",
      description: "Retire un blocage de journée pour un barbier",
      input_schema: {
        type: "object" as const,
        properties: {
          barber: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD ou 'demain'" },
        },
        required: ["barber", "date"],
      },
    },
    {
      name: "get_blocks",
      description: "Liste les journées bloquées à venir",
      input_schema: {
        type: "object" as const,
        properties: { barber: { type: "string", description: "Filtrer par barbier (optionnel)" } },
        required: [],
      },
    },
    {
      name: "get_pending_emails",
      description: "Liste les emails en attente d'approbation Telegram",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "get_holidays",
      description: "Liste les prochains jours fériés du Québec",
      input_schema: {
        type: "object" as const,
        properties: { days: { type: "number", description: "Nombre de jours à regarder en avant (défaut: 30)" } },
        required: [],
      },
    },
    {
      name: "set_reminder",
      description: "Crée un rappel Telegram à une heure précise. Comprend le langage naturel via Claude (ex: 'à 15h', 'demain matin', 'dans 2h').",
      input_schema: {
        type: "object" as const,
        properties: {
          message: { type: "string", description: "Texte du rappel" },
          remind_at: { type: "string", description: "Datetime ISO ou 'YYYY-MM-DD HH:MM'" },
          chat_id: { type: "number", description: "Chat ID où envoyer le rappel" },
        },
        required: ["message", "remind_at", "chat_id"],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  try {
    let reply = "";

    for (let turn = 0; turn < 5; turn++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        tools,
        messages,
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (textBlock) reply = textBlock.text;

      if (response.stop_reason === "end_turn") break;

      if (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        messages.push({ role: "assistant", content: response.content });

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const t of toolUses) {
          const result = await executeTool(t.name, t.input as Record<string, unknown>);
          results.push({ type: "tool_result", tool_use_id: t.id, content: result });
        }
        messages.push({ role: "user", content: results });
      } else break;
    }

    if (!reply) reply = "J'ai trouvé les infos mais j'arrive pas à formuler. Réessaie avec d'autres mots.";
    await saveHistory(chatId, "assistant", reply);
    await sendTelegramMessage(chatId, reply);
  } catch (e) {
    console.error("Conversation error:", e);
    await sendTelegramMessage(chatId, "🔴 Erreur technique — réessaie dans une seconde.");
  }
}

// ── Photo receipt handler ─────────────────────────────────────────────────────
async function handlePhotoReceipt(chatId: number, fileId: string, caption?: string): Promise<void> {
  await sendTelegramMessage(chatId, "📸 Photo reçue — j'analyse le reçu...");

  try {
    // 1. Get file path from Telegram
    const fileRes = await fetch(`${TELEGRAM_API}${getToken()}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json() as { ok: boolean; result: { file_path: string } };
    if (!fileData.ok) { await sendTelegramMessage(chatId, "❌ Impossible de télécharger la photo."); return; }

    // 2. Download image bytes
    const imgUrl = `https://api.telegram.org/file/bot${getToken()}/${fileData.result.file_path}`;
    const imgRes = await fetch(imgUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = fileData.result.file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    // 3. Claude Vision — extract expense data
    const visionRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          {
            type: "text",
            text: `Tu es l'assistant comptable de Ciseau Noir Barbershop. Analyse ce reçu et extrais les informations.
${caption ? `Note de l'utilisateur: "${caption}"` : ""}

Réponds UNIQUEMENT avec ce JSON (rien d'autre):
{
  "description": "description courte de l'achat",
  "amount": 0.00,
  "category": "Fournitures|Équipement|Loyer|Marketing|Employés|Services|Autre",
  "date": "YYYY-MM-DD",
  "store": "nom du magasin",
  "confidence": "high|medium|low"
}

Si tu ne vois pas de montant clairement, mets confidence: "low".
Date d'aujourd'hui si pas visible sur le reçu: ${new Date().toISOString().slice(0,10)}`,
          },
        ],
      }],
    });

    const rawText = visionRes.content[0].type === "text" ? visionRes.content[0].text.trim() : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { await sendTelegramMessage(chatId, "❌ Pas de reçu reconnu dans cette photo."); return; }

    const expense = JSON.parse(jsonMatch[0]) as {
      description: string; amount: number; category: string;
      date: string; store?: string; confidence: string;
    };

    if (expense.confidence === "low" || !expense.amount) {
      await sendTelegramMessage(chatId,
        `⚠️ Je vois un reçu mais le montant est flou.\n\nDis-moi : "Ajoute dépense: [description] [montant]$"`
      );
      return;
    }

    // 4. Save expense
    const validCategories = ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"];
    const finalCategory = validCategories.includes(expense.category) ? expense.category : "Autre";

    await supabaseAdmin.from("expenses").insert({
      description: expense.description,
      amount: expense.amount,
      category: finalCategory,
      date: expense.date,
    });

    const storeNote = expense.store ? ` — ${expense.store}` : "";
    await sendTelegramMessage(chatId,
      `✅ <b>Dépense ajoutée</b>${storeNote}\n\n` +
      `📋 ${expense.description}\n` +
      `💰 ${expense.amount}$\n` +
      `📁 ${finalCategory}\n` +
      `📅 ${expense.date}\n\n` +
      `<i>Si c'est pas exact, dis "Corrige la dernière dépense: [correction]"</i>`
    );
  } catch (e) {
    console.error("Photo receipt error:", e);
    await sendTelegramMessage(chatId, "❌ Erreur lors de l'analyse. Essaie une photo plus nette ou ajoute la dépense manuellement.");
  }
}

// ── Reminder callback handler ─────────────────────────────────────────────────
async function handleReminderCallback(callbackId: string, data: string, chatId: number, messageId: number): Promise<void> {
  await answerCallback(callbackId);

  const [action, reminderId] = data.split("_REMIND_");

  if (action === "done") {
    await supabaseAdmin.from("reminders").update({ done: true }).eq("id", reminderId);
    await editMessage(chatId, messageId, "✅ Fait !");
  } else if (action === "snooze30") {
    const snoozeUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabaseAdmin.from("reminders").update({ snoozed_until: snoozeUntil }).eq("id", reminderId);
    await editMessage(chatId, messageId, "⏰ Rappel dans 30 minutes.");
  } else if (action === "cancel") {
    await supabaseAdmin.from("reminders").update({ done: true }).eq("id", reminderId);
    await editMessage(chatId, messageId, "❌ Rappel annulé.");
  }
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const update = await req.json();

    // ── Callback buttons (approval + reminders) ───────────────────────────────
    if (update.callback_query) {
      const { id, data, message } = update.callback_query as {
        id: string; data?: string;
        message: { chat: { id: number }; message_id: number };
      };

      // Reminder buttons
      if (data && data.includes("_REMIND_")) {
        await handleReminderCallback(id, data, message.chat.id, message.message_id);
        return NextResponse.json({ ok: true });
      }

      await answerCallback(id);

      if (!data || (!data.startsWith("approve_") && !data.startsWith("refuse_"))) {
        return NextResponse.json({ ok: true });
      }

      const sep = data.indexOf("_");
      const isApprove = data.slice(0, sep) === "approve";
      const draftId = data.slice(sep + 1);

      const { data: draft, error } = await supabaseAdmin
        .from("figaro_messages").select("*").eq("id", draftId).single();

      if (error || !draft) {
        await editMessage(message.chat.id, message.message_id, "❌ Draft introuvable (peut-être déjà traité).");
        return NextResponse.json({ ok: true });
      }

      const { gmailId, threadId, subject } = extractGmailMeta(draft.message as string);

      if (isApprove) {
        if (threadId) await sendGmailReply({ threadId, to: draft.from_email as string, subject: `Re: ${subject}`, body: draft.ai_response as string });
        if (gmailId) await archiveEmail(gmailId);
        await editMessage(message.chat.id, message.message_id, `✅ Réponse envoyée à ${draft.from_email}`);
      } else {
        if (gmailId) await archiveEmail(gmailId);
        await editMessage(message.chat.id, message.message_id, `📁 Archivé sans réponse.`);
      }

      await supabaseAdmin.from("figaro_messages").update({ escalated: false }).eq("id", draftId);
      return NextResponse.json({ ok: true });
    }

    // ── Text messages ──────────────────────────────────────────────────────────
    if (update.message?.text) {
      const chatId = update.message.chat.id as number;
      const rawText = (update.message.text as string).trim();
      const text = stripBotMention(rawText);

      if (text === "/start" || text === "/aide" || text === "/help") {
        await sendTelegramMessage(chatId,
          `✂️ <b>Figaro — Ciseau Noir</b>\n\n` +
          `Parle-moi normalement :\n\n` +
          `📅 "RDV de Melynda demain"\n` +
          `📅 "Agenda de cette semaine"\n` +
          `💰 "Revenus de ce mois"\n` +
          `🔍 "Cherche le client Tremblay"\n` +
          `❌ "Annule le RDV de [nom]"\n` +
          `💸 "Ajoute dépense: suppléments 45$"\n` +
          `🔒 "Bloque Diodis vendredi 9 mai"\n` +
          `🔓 "Débloque Melynda lundi"\n` +
          `📧 "Emails en attente"\n\n` +
          `Je retiens toute notre conversation.\n\n` +
          `<b>Si je réponds pas dans le groupe :</b>\n` +
          `Mentionne-moi : <code>@CiseauNoirOps_bot RDV de demain</code>\n` +
          `Ou active la réception complète :\n` +
          `BotFather → /mybots → ton bot → Bot Settings → Group Privacy → Turn off\n\n` +
          `/oublier — efface la mémoire`
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "/oublier" || text === "/reset") {
        await supabaseAdmin.from("telegram_conversations").delete().eq("chat_id", chatId);
        await sendTelegramMessage(chatId, "✅ Mémoire effacée. On repart à zéro !");
        return NextResponse.json({ ok: true });
      }

      // In groups: only respond if the bot is mentioned OR message is a command
      const isGroup = update.message.chat.type === "group" || update.message.chat.type === "supergroup";
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CiseauNoirOps_bot";
      const isMentioned = rawText.includes(`@${botUsername}`);
      const isCommand = rawText.startsWith("/");

      if (isGroup && !isMentioned && !isCommand) {
        // Silent — not mentioned in group
        return NextResponse.json({ ok: true });
      }

      await handleConversation(chatId, text);
    }

    // ── Photo messages (receipt scanning) ────────────────────────────────────
    if (update.message?.photo) {
      const chatId = update.message.chat.id as number;

      // In groups: only respond if bot is mentioned in caption
      const isGroup = update.message.chat.type === "group" || update.message.chat.type === "supergroup";
      const caption = (update.message.caption as string | undefined) || "";
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CiseauNoirOps_bot";
      if (isGroup && !caption.includes(`@${botUsername}`)) {
        return NextResponse.json({ ok: true });
      }

      // Take the largest photo version (last in array)
      const photos = update.message.photo as { file_id: string; width: number }[];
      const bestPhoto = photos[photos.length - 1];
      await handlePhotoReceipt(chatId, bestPhoto.file_id, caption);
    }

  } catch (e) {
    console.error("Telegram webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}
