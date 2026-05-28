import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendGmailReply, archiveEmail } from "@/lib/gmail";
import { getUpcomingHolidays, isHoliday } from "@/lib/holidays-qc";
import { sendSMS, formatPhone } from "@/lib/sms";
import { Resend } from "resend";
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");
const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";
export const dynamic = 'force-dynamic';

const TELEGRAM_API = "https://api.telegram.org/bot";

const MODEL_FAST = MODELS.FAST;
const MODEL_SMART = MODELS.BALANCED;

// Détecte si la requête nécessite Sonnet ou si Haiku suffit
function needsSonnet(msg: string): boolean {
  const complexPatterns = /crée|réserve|book|nouveau rdv|annule|modifi|pourquoi|analys|expliq|conseil|idée|suggère|note|souviens|retiens|compare|tendance/i;
  return complexPatterns.test(msg) || msg.length > 200;
}

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
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // max 24h
      .order("created_at", { ascending: false })
      .limit(16);
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

  // ── get_client_history ───────────────────────────────────────────────────────
  if (name === "get_client_history") {
    const query = input.query as string; // nom, email, ou téléphone
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, client_name, client_phone, client_email, service, barber, date, time, status, price")
      .or(`client_name.ilike.%${query}%,client_phone.ilike.%${query}%,client_email.ilike.%${query}%`)
      .order("date", { ascending: false })
      .limit(15);

    if (!data?.length) return `Aucun client trouvé pour "${query}".`;

    const client = data[0];
    const completed = data.filter(b => b.status === "completed" || b.status === "confirmed").length;
    const total = data.reduce((s, b) => s + (b.price || 0), 0);
    const lastVisit = data.find(b => b.date <= todayQC())?.date || "—";
    const nextVisit = data.find(b => b.date > todayQC());

    let result = `👤 <b>${client.client_name}</b>\n`;
    result += `📞 ${client.client_phone || "—"} | 📧 ${client.client_email || "—"}\n`;
    result += `📊 ${completed} visites — ${total}$ total\n`;
    result += `⬅️ Dernière visite : ${lastVisit}\n`;
    if (nextVisit) result += `➡️ Prochain RDV : ${nextVisit.date} à ${nextVisit.time} (${nextVisit.barber})\n`;
    result += `\n<b>Historique :</b>\n`;
    result += data.slice(0, 8).map(b =>
      `${b.date} ${b.time} — ${b.service} avec ${b.barber} — ${b.price}$ [${b.status}]`
    ).join("\n");
    return result;
  }

  // ── create_booking ───────────────────────────────────────────────────────────
  if (name === "create_booking") {
    const { client_name, client_phone, client_email, service, barber, date, time, price, note } =
      input as Record<string, string>;

    const SERVICES: Record<string, number> = {
      "Coupe": 35, "Coupe + Barbe": 50, "Barbe": 20,
      "Coupe Enfant": 25, "Étudiant": 25, "Coupe + Rasage": 50,
    };
    const finalPrice = Number(price) || SERVICES[service] || 35;

    const { data, error } = await supabaseAdmin.from("bookings").insert({
      client_name, client_phone: client_phone || "", client_email: client_email || "",
      service, barber, date, time, price: finalPrice,
      status: "confirmed", note: note || "",
    }).select("id").single();

    if (error) return `Erreur : ${error.message}`;
    return `✅ RDV créé !\n${client_name} — ${service} avec ${barber}\n${date} à ${time} — ${finalPrice}$\nID: [${(data.id as string).slice(0,8)}]`;
  }

  // ── save_note ─────────────────────────────────────────────────────────────────
  if (name === "save_note") {
    const key = input.key as string;
    const content = input.content as string;
    await supabaseAdmin.from("figaro_notes").upsert(
      { key, content, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return `✅ Note sauvegardée : "${key}"`;
  }

  // ── get_notes ─────────────────────────────────────────────────────────────────
  if (name === "get_notes") {
    const { data } = await supabaseAdmin
      .from("figaro_notes").select("key, content, updated_at").order("updated_at", { ascending: false });
    if (!data?.length) return "Aucune note sauvegardée.";
    return data.map(n => `📝 <b>${n.key}</b>\n${n.content}`).join("\n\n");
  }

  // ── reschedule_booking ───────────────────────────────────────────────────────
  if (name === "reschedule_booking") {
    const id = input.id as string;
    const newDate = input.new_date as string;
    const newTime = input.new_time as string;

    const { data: current } = await supabaseAdmin
      .from("bookings").select("client_name, service, barber, date, time").eq("id", id).single();
    if (!current) return `Impossible de trouver le RDV [${id}].`;

    const { error } = await supabaseAdmin
      .from("bookings").update({ date: newDate, time: newTime }).eq("id", id);
    if (error) return `Erreur : ${error.message}`;

    return `✅ RDV déplacé !\n${current.client_name} — ${current.service} avec ${current.barber}\n` +
      `Ancien: ${current.date} à ${current.time}\nNouveau: ${newDate} à ${newTime}`;
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

  // ── update_booking ───────────────────────────────────────────────────────────
  if (name === "update_booking") {
    const id = input.id as string;
    const updates: Record<string, unknown> = {};
    if (input.service) updates.service = input.service;
    if (input.barber) updates.barber = input.barber;
    if (input.price !== undefined) updates.price = Number(input.price);
    if (input.note !== undefined) updates.note = input.note;
    if (input.client_name) updates.client_name = input.client_name;
    if (input.client_phone) updates.client_phone = input.client_phone;
    if (input.client_email) updates.client_email = input.client_email;
    if (!Object.keys(updates).length) return "Aucune modification spécifiée.";

    const { data, error } = await supabaseAdmin
      .from("bookings").update(updates).eq("id", id)
      .select("client_name, service, barber, date, time").single();
    if (error || !data) return `Impossible de trouver le RDV [${id}]. Vérifie l'ID.`;
    return `✅ RDV mis à jour : ${data.client_name} — ${data.service} avec ${data.barber}, ${data.date} à ${data.time}\nModifications : ${Object.entries(updates).map(([k,v]) => `${k}=${v}`).join(", ")}`;
  }

  // ── send_sms ─────────────────────────────────────────────────────────────────
  if (name === "send_sms") {
    const phone = input.phone as string;
    const message = input.message as string;
    try {
      await sendSMS(phone, message, "figaro-custom");
      return `✅ SMS envoyé à ${formatPhone(phone)}\n\n"${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`;
    } catch (e) {
      return `❌ Erreur SMS : ${e instanceof Error ? e.message : "inconnu"}`;
    }
  }

  // ── send_email ───────────────────────────────────────────────────────────────
  if (name === "send_email") {
    const toEmail = input.to_email as string;
    const toName = (input.to_name as string) || "";
    const subject = input.subject as string;
    const body = input.body as string;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: toName ? `${toName} <${toEmail}>` : toEmail,
        subject,
        html: `<div style="font-family: Georgia, serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px;">
          <p style="color: #888; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Ciseau Noir Barbershop</p>
          ${body.split("\n").map(line => `<p style="margin: 8px 0;">${line}</p>`).join("")}
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">✂️ Ciseau Noir — 375 Boul. des Chutes, Québec — (418) 665-5703</p>
        </div>`,
        text: body,
      });
      return `✅ Email envoyé à ${toEmail}\nSujet : "${subject}"`;
    } catch (e) {
      return `❌ Erreur email : ${e instanceof Error ? e.message : "inconnu"}`;
    }
  }

  return "Outil inconnu.";
}

// ── Conversation handler ──────────────────────────────────────────────────────
async function handleConversation(chatId: number, userMessage: string): Promise<void> {
  const todayQCStr = todayQC();
  const todayLabel = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
    .toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Charge historique + notes persistantes en parallèle
  const [history, notesData, rdvAujourdhui] = await Promise.all([
    loadHistory(chatId),
    supabaseAdmin.from("figaro_notes").select("key, content").order("updated_at", { ascending: false }).limit(20),
    supabaseAdmin.from("bookings").select("id", { count: "exact" })
      .eq("date", todayQCStr).neq("status", "cancelled"),
  ]);

  await saveHistory(chatId, "user", userMessage);

  const notes = notesData.data?.map(n => `• ${n.key}: ${n.content}`).join("\n") || "Aucune note";
  const rdvCount = rdvAujourdhui.count || 0;

  const systemPrompt = `Tu es Figaro ✂️ — l'assistante de Melynda et Luca, Ciseau Noir Barbershop, 375 Boul. des Chutes, Québec.

TON STYLE:
— Québécois naturel. Court et direct. Max 4-5 lignes sauf si liste nécessaire.
— Pas de "Bien sûr!" ou "Absolument!". Réponds et agis.
— T'as une opinion. Si quelque chose cloche, tu le dis.
— Quand on te donne une info utile → save_note automatiquement, sans demander.

AUJOURD'HUI: ${todayLabel}
RDV aujourd'hui: ${rdvCount} confirmés

LE SALON:
— Services: Coupe 35$ | Coupe+Barbe 50$ | Barbe 20$ | Coupe Enfant/Étudiant 25$ | Coupe+Rasage Lame 50$
— Melynda: Mar/Mer/Sam 8h30-16h30 | Jeu/Ven 8h30-20h30
— Barbier disponible: temps partiel (horaire variable — utilise get_bookings pour vérifier sa dispo)
— Il y a DEUX barbiers : Melynda ET Barbier disponible
— Fermé dimanche + lundi
— Tel: (418) 665-5703

MÉMOIRE PERSISTANTE:
${notes}

OUTILS DISPONIBLES (utilise-les — jamais de chiffres inventés):
• get_bookings — agenda par période/barbier
• get_revenue — revenus par période
• search_client / get_client_history — chercher un client
• create_booking — créer un RDV (demande ce qui manque d'abord)
• update_booking — modifier service/barbier/prix/note d'un RDV existant
• reschedule_booking — déplacer un RDV à une nouvelle date/heure
• cancel_booking — annuler un RDV (cherche d'abord avec search_client)
• add_expense — ajouter une dépense (catégories: Fournitures, Équipement, Loyer, Marketing, Employés, Services, Autre)
• block_barber_day / unblock_barber_day / get_blocks — gérer les disponibilités
• get_pending_emails — emails en attente d'approbation
• get_holidays — jours fériés QC
• set_reminder — créer un rappel (remind_at: "YYYY-MM-DD HH:MM", chat_id: ${chatId})
• save_note / get_notes — mémoire persistante
• send_sms — envoyer un SMS personnalisé à un client (numéro de téléphone requis)
• send_email — envoyer un email personnalisé à un client (adresse email requise)

RÈGLES:
→ Pour créer un RDV: besoin de nom+service+barbier+date+heure. Demande ce qui manque. Barbier = "Melynda" ou "Barbier disponible".
→ Pour annuler/déplacer: cherche d'abord avec search_client puis confirme avec l'humain.
→ Reminders: convertis "dans 2h", "à 15h", "demain matin" en datetime exact (QC timezone).
→ Toujours vérifier avec get_bookings avant de créer — évite les doublons.
→ SMS: toujours demander confirmation avant d'envoyer si le message est important.
→ Email: si un client n'a pas d'email dans la BD, signale-le clairement.`;

  const tools: Anthropic.Tool[] = [
    {
      name: "get_bookings",
      description: "Retourne les RDV pour une période et/ou un barbier",
      input_schema: { type: "object" as const, properties: {
        period: { type: "string", enum: ["today", "tomorrow", "this_week", "next_week", "last_week"] },
        barber: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      }, required: [] },
    },
    {
      name: "get_revenue",
      description: "Calcule les revenus",
      input_schema: { type: "object" as const, properties: {
        period: { type: "string", enum: ["today", "this_week", "last_week", "this_month"] },
      }, required: ["period"] },
    },
    {
      name: "get_client_history",
      description: "Historique complet d'un client — visites, montants, prochain RDV",
      input_schema: { type: "object" as const, properties: {
        query: { type: "string", description: "Nom, téléphone ou email du client" },
      }, required: ["query"] },
    },
    {
      name: "search_client",
      description: "Recherche rapide par nom",
      input_schema: { type: "object" as const, properties: { name: { type: "string" } }, required: ["name"] },
    },
    {
      name: "create_booking",
      description: "Crée un nouveau RDV directement depuis Telegram",
      input_schema: { type: "object" as const, properties: {
        client_name: { type: "string" },
        client_phone: { type: "string" },
        client_email: { type: "string" },
        service: { type: "string", description: "Coupe / Coupe+Barbe / Barbe / Coupe Enfant / Coupe+Rasage" },
        barber: { type: "string", enum: ["Melynda", "Barbier disponible"] },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
        price: { type: "number" },
        note: { type: "string" },
      }, required: ["client_name", "service", "barber", "date", "time"] },
    },
    {
      name: "cancel_booking",
      description: "Annule un RDV par ID",
      input_schema: { type: "object" as const, properties: {
        id: { type: "string", description: "UUID ou 8 premiers chars" },
      }, required: ["id"] },
    },
    {
      name: "reschedule_booking",
      description: "Déplace un RDV à une nouvelle date/heure",
      input_schema: { type: "object" as const, properties: {
        id: { type: "string", description: "UUID du RDV" },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_time: { type: "string", description: "HH:MM" },
      }, required: ["id", "new_date", "new_time"] },
    },
    {
      name: "add_expense",
      description: "Ajoute une dépense",
      input_schema: { type: "object" as const, properties: {
        description: { type: "string" }, amount: { type: "number" },
        category: { type: "string", enum: ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"] },
        date: { type: "string" },
      }, required: ["description", "amount"] },
    },
    {
      name: "block_barber_day",
      description: "Bloque une journée (empêche les réservations)",
      input_schema: { type: "object" as const, properties: {
        barber: { type: "string", enum: ["Melynda", "Barbier disponible"] },
        date: { type: "string", description: "YYYY-MM-DD" },
        reason: { type: "string" },
      }, required: ["barber", "date"] },
    },
    {
      name: "unblock_barber_day",
      description: "Retire un blocage",
      input_schema: { type: "object" as const, properties: {
        barber: { type: "string" }, date: { type: "string" },
      }, required: ["barber", "date"] },
    },
    {
      name: "get_blocks",
      description: "Journées bloquées à venir",
      input_schema: { type: "object" as const, properties: { barber: { type: "string" } }, required: [] },
    },
    {
      name: "get_pending_emails",
      description: "Emails en attente d'approbation",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "get_holidays",
      description: "Prochains jours fériés QC",
      input_schema: { type: "object" as const, properties: { days: { type: "number" } }, required: [] },
    },
    {
      name: "set_reminder",
      description: "Crée un rappel Telegram",
      input_schema: { type: "object" as const, properties: {
        message: { type: "string" },
        remind_at: { type: "string", description: "YYYY-MM-DD HH:MM" },
        chat_id: { type: "number" },
      }, required: ["message", "remind_at", "chat_id"] },
    },
    {
      name: "save_note",
      description: "Sauvegarde une info importante sur Melynda, Luca ou le salon — survit entre sessions",
      input_schema: { type: "object" as const, properties: {
        key: { type: "string", description: "Nom court de la note ex: melynda_preference_alertes" },
        content: { type: "string", description: "Contenu de la note" },
      }, required: ["key", "content"] },
    },
    {
      name: "get_notes",
      description: "Affiche toutes les notes mémorisées",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "update_booking",
      description: "Modifie les détails d'un RDV existant (service, barbier, prix, note)",
      input_schema: { type: "object" as const, properties: {
        id: { type: "string", description: "UUID ou 8 premiers chars du RDV" },
        service: { type: "string" },
        barber: { type: "string", enum: ["Melynda", "Barbier disponible"] },
        price: { type: "number" },
        note: { type: "string" },
        client_name: { type: "string" },
        client_phone: { type: "string" },
        client_email: { type: "string" },
      }, required: ["id"] },
    },
    {
      name: "send_sms",
      description: "Envoie un SMS personnalisé à un numéro de téléphone",
      input_schema: { type: "object" as const, properties: {
        phone: { type: "string", description: "Numéro de téléphone du client" },
        message: { type: "string", description: "Texte du SMS (max 160 chars recommandé)" },
      }, required: ["phone", "message"] },
    },
    {
      name: "send_email",
      description: "Envoie un email personnalisé à un client",
      input_schema: { type: "object" as const, properties: {
        to_email: { type: "string", description: "Adresse email du destinataire" },
        to_name: { type: "string", description: "Nom du destinataire" },
        subject: { type: "string", description: "Sujet de l'email" },
        body: { type: "string", description: "Corps du message (texte simple)" },
      }, required: ["to_email", "subject", "body"] },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  // Choix du modèle selon complexité
  const model = needsSonnet(userMessage) ? MODEL_SMART : MODEL_FAST;

  try {
    let reply = "";

    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
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

    if (!reply) reply = "Je t'entends mais j'arrive pas à formuler. Reformule et réessaie.";
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
      model: MODELS.BALANCED,
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
      // Ignore messages from other bots (avoid loops)
      if (update.message.from?.is_bot) return NextResponse.json({ ok: true });

      const chatId = update.message.chat.id as number;
      const rawText = (update.message.text as string).trim();
      const text = stripBotMention(rawText);

      if (text === "/start" || text === "/aide" || text === "/help") {
        await sendTelegramMessage(chatId,
          `✂️ <b>Figaro — ton assistant Ciseau Noir</b>\n\n` +
          `Parle-moi comme à quelqu'un qui connaît le salon :\n\n` +
          `<b>📅 Agenda</b>\n` +
          `• "RDV de demain"\n` +
          `• "Agenda Melynda cette semaine"\n` +
          `• "Book Marie samedi 10h Melynda coupe"\n` +
          `• "Déplace le RDV de Tremblay à lundi 14h"\n` +
          `• "Annule le RDV de Jean"\n\n` +
          `<b>💰 Finance</b>\n` +
          `• "On a fait combien cette semaine?"\n` +
          `• "Ajoute dépense: Wahl 89$"\n` +
          `• 📸 Photo de reçu → dépense créée automatiquement\n\n` +
          `<b>👤 Clients</b>\n` +
          `• "Historique de Tremblay"\n` +
          `• "C'est qui Marie Lavoie?"\n\n` +
          `<b>🔒 Disponibilités</b>\n` +
          `• "Bloque Melynda vendredi 23 mai — vacances"\n` +
          `• "Journées bloquées à venir?"\n\n` +
          `<b>⏰ Rappels</b>\n` +
          `• "Rappelle-moi à 15h d'appeler le fournisseur"\n\n` +
          `/oublier — efface l'historique de conversation`
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "/oublier" || text === "/reset") {
        await supabaseAdmin.from("telegram_conversations").delete().eq("chat_id", chatId);
        await sendTelegramMessage(chatId, "✅ Historique effacé. On repart à zéro !");
        return NextResponse.json({ ok: true });
      }

      if (text === "/rdv" || text === "/aujourd'hui") {
        await handleConversation(chatId, "RDV d'aujourd'hui");
        return NextResponse.json({ ok: true });
      }

      if (text === "/stats") {
        await handleConversation(chatId, "Donne-moi les stats de la semaine : RDV, revenus, et compare avec la semaine passée");
        return NextResponse.json({ ok: true });
      }

      // Groupe admin privé — répondre à tout le monde (pas besoin de mention @bot)
      // On ignore seulement les messages des autres bots (traité plus haut)
      await handleConversation(chatId, text);
    }

    // ── Photo messages (receipt scanning) ────────────────────────────────────
    if (update.message?.photo) {
      // Ignore messages from other bots
      if (update.message.from?.is_bot) return NextResponse.json({ ok: true });

      const chatId = update.message.chat.id as number;
      const caption = (update.message.caption as string | undefined) || "";

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
