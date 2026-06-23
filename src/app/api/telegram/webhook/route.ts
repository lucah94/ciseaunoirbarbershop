import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendGmailReply, archiveEmail } from "@/lib/gmail";
import { getUpcomingHolidays } from "@/lib/holidays-qc";
import { sendSMS, formatPhone } from "@/lib/sms";
import { Resend } from "resend";
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, generateText, MODELS } from "@/lib/ai";
import { resolveService } from "@/lib/serviceLookup";
import { serviceDuration } from "@/lib/serviceDuration";
import { generatePost, publishPostToFacebook } from "@/lib/posts";
import {
  proposePostOnTelegram,
  notifyBookingCancelled,
  notifyBookingRescheduled,
} from "@/lib/telegram";

const resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder-resend-key");
const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";
export const dynamic = "force-dynamic";

const TELEGRAM_API = "https://api.telegram.org/bot";
const TZ = "America/Toronto";

const MODEL_FAST = MODELS.FAST;
const MODEL_SMART = MODELS.BALANCED;

// ── Appel IA AVEC outils (tool use) + FALLBACK Sonnet ──────────────────────────
async function createWithFallback(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model"> & { model: string }
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (e) {
    console.error(`[telegram] modèle "${params.model}" a échoué — fallback Sonnet:`, e);
    if (params.model === MODELS.SMART) throw e;
    return await anthropic.messages.create({ ...params, model: MODELS.SMART });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// A) SÉCURITÉ — défense en profondeur (secret_token + allowlist chat_id)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compare en TEMPS CONSTANT le header X-Telegram-Bot-Api-Secret-Token au secret attendu.
 * FAIL CLOSED : si TELEGRAM_WEBHOOK_SECRET n'est pas configuré → on REJETTE tout
 * (jamais fail-open — c'est exactement la faille GHSA-mp5h-m6qj-6292).
 */
function verifyWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[telegram] TELEGRAM_WEBHOOK_SECRET non configuré — fail closed, requête rejetée.");
    return false;
  }
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual throw si longueurs ≠
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Allowlist des chat_id admin (Melynda / Luca) — CSV dans TELEGRAM_ADMIN_CHAT_IDS.
 * Fallback : TELEGRAM_GROUP_CHAT_ID (le groupe ops déjà connu) pour ne pas se verrouiller dehors.
 * Si AUCUNE allowlist n'est définie → fail closed (on n'accepte personne).
 */
function getAllowedChatIds(): Set<string> {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_GROUP_CHAT_ID || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isAllowedChat(chatId: number | string | undefined): boolean {
  if (chatId === undefined || chatId === null) return false;
  const allowed = getAllowedChatIds();
  if (allowed.size === 0) return false; // fail closed
  return allowed.has(String(chatId));
}

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

// ── Telegram API helpers ───────────────────────────────────────────────────────
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
  } catch {
    return { gmailId: "", threadId: "", subject: "" };
  }
}

function stripBotMention(text: string): string {
  return text.replace(/^@\S+\s*/, "").trim();
}

// ── Memory ──────────────────────────────────────────────────────────────────
async function loadHistory(chatId: number): Promise<Anthropic.MessageParam[]> {
  try {
    const { data } = await supabaseAdmin
      .from("telegram_conversations")
      .select("role, content")
      .eq("chat_id", chatId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(16);
    if (!data?.length) return [];
    return data.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  } catch {
    return [];
  }
}

async function saveHistory(chatId: number, role: "user" | "assistant", content: string): Promise<void> {
  try {
    await supabaseAdmin.from("telegram_conversations").insert({ chat_id: chatId, role, content });
    const { data } = await supabaseAdmin
      .from("telegram_conversations")
      .select("id")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .range(40, 9999);
    if (data?.length) {
      await supabaseAdmin.from("telegram_conversations").delete().in("id", data.map((d) => d.id));
    }
  } catch {
    /* silent */
  }
}

// ────────────────────────────────────────────────────────────────────────────
// D) parseDate — FR jours nommés, "dans N jours", relatif, AAAA-MM-JJ (fuseau QC)
//    Retourne null si non compris → l'IA reçoit une erreur explicite, JAMAIS la
//    chaîne brute n'atteint la DB.
// ────────────────────────────────────────────────────────────────────────────
function todayQC(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function tomorrowQC(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Date QC "maintenant" comme objet manipulable en heure locale QC. */
function nowInQC(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function fmtCA(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Ajoute n jours à aujourd'hui (heure QC) et renvoie YYYY-MM-DD. */
function addDaysQC(n: number): string {
  const d = nowInQC();
  d.setDate(d.getDate() + n);
  return fmtCA(d);
}

const DOW_FR: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

const normTxt = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Convertit une expression de date en YYYY-MM-DD (fuseau QC).
 * Comprend : "aujourd'hui", "demain", "après-demain", "lundi".."dimanche",
 * "samedi prochain", "dans N jours", et le format AAAA-MM-JJ direct.
 * @returns string YYYY-MM-DD ou null si incompris (le bot dit "date pas comprise").
 */
function parseDate(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();

  // Format ISO direct
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const dt = new Date(`${y}-${m}-${d}T12:00:00`);
    if (!isNaN(dt.getTime())) return `${y}-${m}-${d}`;
    return null;
  }

  const t = normTxt(raw);
  if (t === "aujourd'hui" || t === "aujourd hui" || t === "today" || t === "auj") return todayQC();
  if (t === "demain" || t === "tomorrow") return tomorrowQC();
  if (t === "apres-demain" || t === "apres demain") return addDaysQC(2);
  if (t === "hier") return addDaysQC(-1);

  // "dans N jours" / "dans N semaines"
  const dansJours = t.match(/dans\s+(\d+)\s+jour/);
  if (dansJours) return addDaysQC(parseInt(dansJours[1], 10));
  const dansSem = t.match(/dans\s+(\d+)\s+semaine/);
  if (dansSem) return addDaysQC(parseInt(dansSem[1], 10) * 7);

  // Jours nommés FR, avec "prochain" optionnel
  for (const [name, dow] of Object.entries(DOW_FR)) {
    if (t === name || t.startsWith(name + " ") || t === name + " prochain") {
      const wantsNext = t.includes("prochain");
      const now = nowInQC();
      const cur = now.getDay();
      let delta = (dow - cur + 7) % 7;
      if (delta === 0) delta = 7; // "lundi" = le prochain lundi, pas aujourd'hui
      if (wantsNext && delta < 7) {
        // "prochain" = la semaine suivante si le jour est déjà cette semaine
        // delta déjà ≥1 ; on garde le prochain occurence sauf si on veut explicitement +7
      }
      return addDaysQC(delta);
    }
  }

  return null;
}

/** Valide une heure HH:MM (24h). Renvoie "H:MM" normalisé ou null. */
function parseTime(input: string): string | null {
  if (!input) return null;
  const m = input.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${h}:${String(min).padStart(2, "0")}`;
}

function getWeekBounds(offsetWeeks = 0): { start: string; end: string; label: string } {
  const nowQC = nowInQC();
  const dow = nowQC.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(nowQC);
  monday.setDate(nowQC.getDate() + daysToMonday + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const label =
    offsetWeeks === 0 ? "cette semaine"
    : offsetWeeks === 1 ? "la semaine prochaine"
    : offsetWeeks === -1 ? "la semaine passée"
    : `semaine du ${fmt(monday)}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

// ── Barbiers / dispos (dynamique, table barbers) ───────────────────────────────
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
type DaySched = Record<string, { open: string; close: string } | null>;

const minutesOf = (t: string) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};

function genSlots(open: string, close: string, durationMin: number): string[] {
  const out: string[] = [];
  let cur = minutesOf(open);
  const end = minutesOf(close) - durationMin + 15;
  while (cur <= end) {
    out.push(`${Math.floor(cur / 60)}:${String(cur % 60).padStart(2, "0")}`);
    cur += 15;
  }
  return out;
}

async function getActiveBarbers(): Promise<{ name: string; schedule: DaySched }[]> {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("name, schedule, active")
    .eq("active", true)
    .order("created_at", { ascending: true });
  return (data || []) as { name: string; schedule: DaySched }[];
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long" });
}

// ────────────────────────────────────────────────────────────────────────────
// C) OUTILS — chaque outil valide ses arguments.
//   Outils DESTRUCTIFS / SORTANTS exigent confirmed:true (lié aux args exacts).
//   Sans confirmation → renvoie un récap "À CONFIRMER" et N'EXÉCUTE RIEN.
// ────────────────────────────────────────────────────────────────────────────

/** Renvoie un message de demande de confirmation (l'IA doit relire et attendre OUI). */
function needConfirm(recap: string): string {
  return `⛔ ACTION SENSIBLE — NON EXÉCUTÉE.\nRécapitule ceci à l'humain et attends un OUI clair, puis rappelle l'outil avec confirmed:true et EXACTEMENT les mêmes arguments :\n${recap}`;
}

async function executeTool(name: string, input: Record<string, unknown>, chatId: number): Promise<string> {
  // ── get_bookings ───────────────────────────────────────────────────────────
  if (name === "get_bookings") {
    const barber = input.barber as string | undefined;
    const dateInput = input.date as string | undefined;
    const period = (input.period as string | undefined) || "today";

    let startDate: string, endDate: string, label: string;

    if (dateInput) {
      const d = parseDate(dateInput);
      if (!d) return `Date pas comprise : "${dateInput}". Donne une date claire (ex: demain, samedi, 2026-06-25).`;
      startDate = endDate = d;
      label = d;
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
        result += `  [${bk.id.slice(0, 8)}] ${bk.date} ${bk.time} — ${bk.client_name} | ${bk.service}${bk.price ? ` | ${bk.price}$` : ""} | ${bk.client_phone}\n`;
      }
      result += "\n";
    }
    return result.trim();
  }

  // ── check_availability ─────────────────────────────────────────────────────
  if (name === "check_availability") {
    const dateInput = input.date as string;
    const date = parseDate(dateInput);
    if (!date) return `Date pas comprise : "${dateInput}".`;
    const barberFilter = input.barber ? normTxt(input.barber as string) : undefined;
    let dur = 45;
    if (input.service) {
      const svc = await resolveService(input.service as string);
      if (!svc.matched) return `Service "${input.service}" inconnu — précise lequel (Coupe + Lavage, Service Premium, etc.).`;
      dur = serviceDuration(svc.name) || 45;
    }
    const barbers = await getActiveBarbers();
    const dayKey = DAY_KEYS[new Date(date + "T12:00:00").getDay()];

    const { data: bookings } = await supabaseAdmin
      .from("bookings").select("time, end_time, barber, service")
      .eq("date", date).neq("status", "cancelled");

    const lines: string[] = [];
    for (const b of barbers) {
      if (barberFilter && !normTxt(b.name).includes(barberFilter)) continue;
      const day = b.schedule?.[dayKey];
      if (!day) { lines.push(`${b.name}: ne travaille pas ce jour`); continue; }
      const booked = (bookings || []).filter((x) => normTxt(x.barber || "") === normTxt(b.name));
      const free = genSlots(day.open, day.close, dur).filter((t) => {
        const start = minutesOf(t), slotEnd = start + dur;
        return !booked.some((x) => {
          const bStart = minutesOf(x.time || "0:0");
          const bEnd = x.end_time ? minutesOf(x.end_time) : bStart + serviceDuration(x.service || "");
          return start < bEnd && slotEnd > bStart;
        });
      });
      lines.push(free.length ? `${b.name}: ${free.join(", ")} (${free.length} libres)` : `${b.name}: COMPLET`);
    }
    return `${getDayName(date)} ${date}:\n${lines.join("\n") || "Aucun barbier ce jour"}`;
  }

  // ── get_revenue ────────────────────────────────────────────────────────────
  if (name === "get_revenue") {
    const period = (input.period as string) || "this_week";
    let startDate: string, endDate: string, label: string;

    if (period === "today") { startDate = endDate = todayQC(); label = "aujourd'hui"; }
    else if (period === "this_week") { const w = getWeekBounds(0); startDate = w.start; endDate = w.end; label = w.label; }
    else if (period === "last_week") { const w = getWeekBounds(-1); startDate = w.start; endDate = w.end; label = w.label; }
    else if (period === "this_month") {
      const qc = nowInQC();
      startDate = `${qc.getFullYear()}-${String(qc.getMonth() + 1).padStart(2, "0")}-01`;
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

  // ── search_client ──────────────────────────────────────────────────────────
  if (name === "search_client") {
    const q = input.name as string;
    if (!q) return "Donne un nom à chercher.";
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, client_name, client_phone, client_email, service, barber, date, time, status")
      .ilike("client_name", `%${q}%`)
      .order("date", { ascending: false }).limit(5);
    if (!data?.length) return `Aucun client trouvé pour "${q}".`;
    return data.map((b) =>
      `[${b.id.slice(0, 8)}] ${b.client_name} | ${b.client_phone || b.client_email || "—"}\n  ${b.date} ${b.time} — ${b.service} avec ${b.barber} (${b.status})`
    ).join("\n\n");
  }

  // ── get_client_history ─────────────────────────────────────────────────────
  if (name === "get_client_history") {
    const q = input.query as string;
    if (!q) return "Donne un nom, téléphone ou email.";
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, client_name, client_phone, client_email, service, barber, date, time, status, price")
      .or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%,client_email.ilike.%${q}%`)
      .order("date", { ascending: false })
      .limit(15);

    if (!data?.length) return `Aucun client trouvé pour "${q}".`;

    const client = data[0];
    const completed = data.filter((b) => b.status === "completed" || b.status === "confirmed").length;
    const total = data.reduce((s, b) => s + (b.price || 0), 0);
    const lastVisit = data.find((b) => b.date <= todayQC())?.date || "—";
    const nextVisit = data.find((b) => b.date > todayQC());

    let result = `👤 <b>${client.client_name}</b>\n`;
    result += `📞 ${client.client_phone || "—"} | 📧 ${client.client_email || "—"}\n`;
    result += `📊 ${completed} visites — ${total}$ total\n`;
    result += `⬅️ Dernière visite : ${lastVisit}\n`;
    if (nextVisit) result += `➡️ Prochain RDV : ${nextVisit.date} à ${nextVisit.time} (${nextVisit.barber})\n`;
    result += `\n<b>Historique :</b>\n`;
    result += data.slice(0, 8).map((b) =>
      `${b.date} ${b.time} — ${b.service} avec ${b.barber} — ${b.price}$ [${b.status}]`
    ).join("\n");
    return result;
  }

  // ── create_booking ─────────────────────────────────────────────────────────
  if (name === "create_booking") {
    const client_name = input.client_name as string;
    const barber = input.barber as string;
    const date = parseDate(input.date as string);
    const time = parseTime(input.time as string);
    if (!client_name) return "Nom du client manquant.";
    if (!barber) return "Barbier manquant (Melynda / Stéphanie / Barbier dispo).";
    if (!date) return `Date pas comprise : "${input.date}".`;
    if (!time) return `Heure pas comprise : "${input.time}" (format attendu HH:MM).`;
    if (date < todayQC()) return `Date dans le passé (${date}) — refusé. Donne une date future.`;

    // Service & prix via resolveService — JAMAIS inventer.
    const svc = await resolveService(input.service as string);
    if (!svc.matched) {
      return `Service "${input.service}" inconnu. Demande lequel parmi : Coupe + Lavage, Coupe + Barbe à la lame, Coupe + Barbe Shaver, Service Premium, Rasage / Barbe, Enfant (12 ans et moins). Ne devine pas.`;
    }
    // Prix : on prend celui fourni explicitement, sinon le prix officiel du service.
    const finalPrice = input.price !== undefined && Number(input.price) > 0 ? Number(input.price) : svc.price;

    const dur = serviceDuration(svc.name) || 45;
    const endMin = minutesOf(time) + dur;
    const end_time = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    const { data, error } = await supabaseAdmin.from("bookings").insert({
      client_name,
      client_phone: (input.client_phone as string) || "",
      client_email: (input.client_email as string) || "",
      service: svc.name, barber, date, time, end_time, price: finalPrice,
      status: "confirmed", note: (input.note as string) || "", source: "telegram",
    }).select("id").single();

    if (error) return `Erreur : ${error.message}`;
    return `✅ RDV créé !\n${client_name} — ${svc.name} avec ${barber}\n${date} à ${time} — ${finalPrice}$\nID: [${(data.id as string).slice(0, 8)}]`;
  }

  // ── update_booking (modif détails — service/prix = sensible si confirmation) ─
  if (name === "update_booking") {
    const id = input.id as string;
    if (!id) return "ID du RDV manquant.";
    const updates: Record<string, unknown> = {};

    if (input.service) {
      const svc = await resolveService(input.service as string);
      if (!svc.matched) return `Service "${input.service}" inconnu — ne devine pas.`;
      updates.service = svc.name;
      // si le prix n'est pas explicitement donné, on aligne sur le prix officiel
      if (input.price === undefined) updates.price = svc.price;
    }
    if (input.barber) updates.barber = input.barber;
    if (input.price !== undefined) {
      // Changement de PRIX = action sensible → confirmation.
      if (input.confirmed !== true) {
        return needConfirm(`Changer le prix du RDV [${id.slice(0, 8)}] → ${Number(input.price)}$`);
      }
      updates.price = Number(input.price);
    }
    if (input.note !== undefined) updates.note = input.note;
    if (input.client_name) updates.client_name = input.client_name;
    if (input.client_phone) updates.client_phone = input.client_phone;
    if (input.client_email) updates.client_email = input.client_email;
    if (input.status) {
      const s = String(input.status);
      const valid = ["confirmed", "completed", "cancelled", "no_show", "pending"];
      if (!valid.includes(s)) return `Statut invalide "${s}".`;
      updates.status = s;
    }
    if (input.date) {
      const d = parseDate(input.date as string);
      if (!d) return `Date pas comprise : "${input.date}".`;
      updates.date = d;
    }
    if (input.time) {
      const t = parseTime(input.time as string);
      if (!t) return `Heure pas comprise : "${input.time}".`;
      updates.time = t;
    }
    if (!Object.keys(updates).length) return "Aucune modification spécifiée.";

    const { data, error } = await supabaseAdmin
      .from("bookings").update(updates).eq("id", id)
      .select("client_name, service, barber, date, time").single();
    if (error || !data) return `Impossible de trouver le RDV [${id}]. Vérifie l'ID.`;
    return `✅ RDV mis à jour : ${data.client_name} — ${data.service} avec ${data.barber}, ${data.date} à ${data.time}\nModifications : ${Object.keys(updates).join(", ")}`;
  }

  // ── reschedule_booking ─────────────────────────────────────────────────────
  if (name === "reschedule_booking") {
    const id = input.id as string;
    if (!id) return "ID du RDV manquant.";
    const newDate = parseDate(input.new_date as string);
    const newTime = parseTime(input.new_time as string);
    if (!newDate) return `Nouvelle date pas comprise : "${input.new_date}".`;
    if (!newTime) return `Nouvelle heure pas comprise : "${input.new_time}".`;

    const { data: current } = await supabaseAdmin
      .from("bookings").select("client_name, service, barber, date, time").eq("id", id).single();
    if (!current) return `Impossible de trouver le RDV [${id}].`;

    const dur = serviceDuration(current.service) || 45;
    const endMin = minutesOf(newTime) + dur;
    const end_time = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    const { error } = await supabaseAdmin
      .from("bookings").update({ date: newDate, time: newTime, end_time }).eq("id", id);
    if (error) return `Erreur : ${error.message}`;

    try {
      await notifyBookingRescheduled({
        client_name: current.client_name, service: current.service, barber: current.barber,
        old_date: current.date, old_time: current.time, new_date: newDate, new_time: newTime,
      });
    } catch { /* non bloquant */ }

    return `✅ RDV déplacé !\n${current.client_name} — ${current.service} avec ${current.barber}\n` +
      `Ancien: ${current.date} à ${current.time}\nNouveau: ${newDate} à ${newTime}`;
  }

  // ── cancel_booking (DESTRUCTIF → confirmation) ─────────────────────────────
  if (name === "cancel_booking") {
    const id = input.id as string;
    if (!id) return "ID du RDV manquant. Cherche d'abord avec search_client.";

    const { data: target } = await supabaseAdmin
      .from("bookings").select("client_name, service, barber, date, time, status").eq("id", id).single();
    if (!target) return `Impossible de trouver le RDV [${id}]. Vérifie l'ID.`;
    if (target.status === "cancelled") return `Ce RDV est déjà annulé.`;

    if (input.confirmed !== true) {
      return needConfirm(
        `Annuler le RDV [${id.slice(0, 8)}] : ${target.client_name} — ${target.service} avec ${target.barber}, ${target.date} à ${target.time}`
      );
    }

    const { error } = await supabaseAdmin
      .from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return `Erreur : ${error.message}`;
    try {
      await notifyBookingCancelled({
        client_name: target.client_name, service: target.service, barber: target.barber,
        date: target.date, time: target.time,
      });
    } catch { /* non bloquant */ }
    return `✅ RDV annulé : ${target.client_name} — ${target.service} avec ${target.barber}, ${target.date} à ${target.time}`;
  }

  // ── block_barber_day (plage horaire optionnelle) ───────────────────────────
  if (name === "block_barber_day") {
    const barber = input.barber as string;
    if (!barber) return "Barbier manquant.";
    const date = parseDate(input.date as string);
    if (!date) return `Date pas comprise : "${input.date}".`;
    const reason = (input.reason as string) || null;
    const start_time = input.start_time ? parseTime(input.start_time as string) : null;
    const end_time = input.end_time ? parseTime(input.end_time as string) : null;
    if (input.start_time && !start_time) return `Heure début pas comprise : "${input.start_time}".`;
    if (input.end_time && !end_time) return `Heure fin pas comprise : "${input.end_time}".`;

    const { error } = await supabaseAdmin
      .from("barber_blocks")
      .insert({ barber, date, reason, start_time, end_time });
    if (error) return `Erreur : ${error.message}`;
    const range = start_time && end_time ? ` (${start_time}-${end_time})` : " (journée complète)";
    return `✅ Bloqué : ${barber} — ${date}${range}${reason ? ` · ${reason}` : ""}`;
  }

  // ── unblock_barber_day ─────────────────────────────────────────────────────
  if (name === "unblock_barber_day") {
    const barber = input.barber as string;
    if (!barber) return "Barbier manquant.";
    const date = parseDate(input.date as string);
    if (!date) return `Date pas comprise : "${input.date}".`;

    const { data, error } = await supabaseAdmin
      .from("barber_blocks").delete().ilike("barber", barber).eq("date", date).select();
    if (error) return `Erreur : ${error.message}`;
    if (!data?.length) return `Aucun blocage trouvé pour ${barber} le ${date}.`;
    return `✅ Blocage retiré : ${barber} dispo le ${date} (${data.length} bloc(s) retiré(s))`;
  }

  // ── set_barber_override (horaire exceptionnel) ─────────────────────────────
  if (name === "set_barber_override") {
    const barber = input.barber as string;
    if (!barber) return "Barbier manquant.";
    const date = parseDate(input.date as string);
    if (!date) return `Date pas comprise : "${input.date}".`;
    const open = parseTime(input.open as string);
    const close = parseTime(input.close as string);
    if (!open) return `Heure d'ouverture pas comprise : "${input.open}".`;
    if (!close) return `Heure de fermeture pas comprise : "${input.close}".`;

    const { error } = await supabaseAdmin
      .from("barber_day_overrides")
      .upsert({ barber, date, open, close }, { onConflict: "barber,date" });
    if (error) return `Erreur : ${error.message}`;
    return `✅ Horaire exceptionnel : ${barber} le ${date} → ${open}-${close}`;
  }

  // ── get_blocks ─────────────────────────────────────────────────────────────
  if (name === "get_blocks") {
    const barber = input.barber as string | undefined;
    let query = supabaseAdmin
      .from("barber_blocks").select("barber, date, reason, start_time, end_time")
      .gte("date", todayQC())
      .order("date").limit(15);
    if (barber) query = query.ilike("barber", `%${barber}%`);
    const { data } = await query;
    if (!data?.length) return "Aucune journée bloquée à venir.";
    return data.map((b) => {
      const range = b.start_time && b.end_time ? ` ${b.start_time}-${b.end_time}` : " (journée)";
      return `${b.barber} — ${b.date}${range}${b.reason ? ` · ${b.reason}` : ""}`;
    }).join("\n");
  }

  // ── list_barbers ───────────────────────────────────────────────────────────
  if (name === "list_barbers") {
    const { data } = await supabaseAdmin
      .from("barbers").select("name, active, phone, schedule").order("created_at", { ascending: true });
    if (!data?.length) return "Aucun barbier configuré.";
    const LBL: Record<string, string> = { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam", sun: "Dim" };
    const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    return (data as { name: string; active: boolean; phone?: string; schedule?: DaySched }[]).map((b) => {
      const days = ORDER.filter((k) => b.schedule?.[k]).map((k) => `${LBL[k]} ${b.schedule![k]!.open}-${b.schedule![k]!.close}`);
      return `${b.active ? "🟢" : "⚪"} <b>${b.name}</b>${b.phone ? ` · ${b.phone}` : ""}\n   ${days.length ? days.join(", ") : "horaire à confirmer"}`;
    }).join("\n");
  }

  // ── list_services ──────────────────────────────────────────────────────────
  if (name === "list_services") {
    const { data } = await supabaseAdmin
      .from("services").select("name, price, duration_min, active").order("sort_order");
    if (!data?.length) return "Aucun service configuré.";
    return (data as { name: string; price: number; duration_min?: number; active?: boolean }[])
      .map((s) => `${s.active === false ? "⚪" : "•"} ${s.name} — ${s.price}$${s.duration_min ? ` (${s.duration_min} min)` : ""}`)
      .join("\n");
  }

  // ── upsert_service (ajout/modif — changement de prix = sensible → confirm) ──
  if (name === "upsert_service") {
    const svcName = (input.name as string)?.trim();
    if (!svcName) return "Nom du service manquant.";
    const price = input.price !== undefined ? Number(input.price) : undefined;
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return "Prix invalide.";

    const { data: existing } = await supabaseAdmin
      .from("services").select("id, name, price").ilike("name", svcName).maybeSingle();

    // Modif de prix d'un service existant OU création avec prix → action sensible.
    if (price !== undefined && input.confirmed !== true) {
      const verb = existing ? `Modifier le service "${existing.name}" → ${price}$ (avant: ${existing.price}$)` : `Créer le service "${svcName}" à ${price}$`;
      return needConfirm(verb);
    }

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (price !== undefined) updates.price = price;
      if (input.duration_min !== undefined) updates.duration_min = Number(input.duration_min);
      if (input.description !== undefined) updates.description = input.description;
      if (!Object.keys(updates).length) return "Rien à modifier.";
      const { error } = await supabaseAdmin.from("services").update(updates).eq("id", existing.id);
      if (error) return `Erreur : ${error.message}`;
      return `✅ Service "${existing.name}" mis à jour : ${Object.keys(updates).join(", ")}`;
    } else {
      if (price === undefined) return "Pour créer un service, donne un prix.";
      const { error } = await supabaseAdmin.from("services").insert({
        name: svcName, price,
        duration_min: input.duration_min !== undefined ? Number(input.duration_min) : 30,
        description: (input.description as string) || null, active: true,
      });
      if (error) return `Erreur : ${error.message}`;
      return `✅ Service créé : "${svcName}" — ${price}$`;
    }
  }

  // ── delete_service (DESTRUCTIF → confirmation) ─────────────────────────────
  if (name === "delete_service") {
    const svcName = (input.name as string)?.trim();
    if (!svcName) return "Nom du service manquant.";
    const { data: existing } = await supabaseAdmin
      .from("services").select("id, name").ilike("name", svcName).maybeSingle();
    if (!existing) return `Service "${svcName}" introuvable.`;
    if (input.confirmed !== true) {
      return needConfirm(`Supprimer le service "${existing.name}"`);
    }
    const { error } = await supabaseAdmin.from("services").delete().eq("id", existing.id);
    if (error) return `Erreur : ${error.message}`;
    return `✅ Service supprimé : "${existing.name}"`;
  }

  // ── add_expense ────────────────────────────────────────────────────────────
  if (name === "add_expense") {
    const description = input.description as string;
    const amount = Number(input.amount);
    if (!description) return "Description manquante.";
    if (!Number.isFinite(amount) || amount <= 0) return "Montant invalide.";
    const category = (input.category as string) || "Autre";
    const date = input.date ? parseDate(input.date as string) : todayQC();
    if (!date) return `Date pas comprise : "${input.date}".`;

    const validCategories = ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"];
    const finalCategory = validCategories.includes(category) ? category : "Autre";

    const { error } = await supabaseAdmin
      .from("expenses").insert({ description, amount, category: finalCategory, date });
    if (error) return `Erreur lors de l'ajout de la dépense : ${error.message}`;
    return `✅ Dépense ajoutée : ${description} — ${amount}$ (${finalCategory}) le ${date}`;
  }

  // ── send_sms (SORTANT → confirmation) ──────────────────────────────────────
  if (name === "send_sms") {
    const phone = input.phone as string;
    const message = input.message as string;
    if (!phone) return "Numéro de téléphone manquant.";
    if (!message) return "Message vide.";
    if (input.confirmed !== true) {
      return needConfirm(`Envoyer un SMS à ${formatPhone(phone)} :\n"${message}"`);
    }
    try {
      await sendSMS(phone, message, "figaro-custom");
      return `✅ SMS envoyé à ${formatPhone(phone)}\n\n"${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`;
    } catch (e) {
      return `❌ Erreur SMS : ${e instanceof Error ? e.message : "inconnu"}`;
    }
  }

  // ── send_email (SORTANT → confirmation) ────────────────────────────────────
  if (name === "send_email") {
    const toEmail = input.to_email as string;
    const toName = (input.to_name as string) || "";
    const subject = input.subject as string;
    const body = input.body as string;
    if (!toEmail || !/.+@.+\..+/.test(toEmail)) return "Email destinataire invalide.";
    if (!subject || !body) return "Sujet ou corps manquant.";
    if (input.confirmed !== true) {
      return needConfirm(`Envoyer un email à ${toEmail}\nSujet : ${subject}\n${body.slice(0, 200)}`);
    }
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: toName ? `${toName} <${toEmail}>` : toEmail,
        subject,
        html: `<div style="font-family: Georgia, serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px;">
          <p style="color: #888; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Ciseau Noir Barbershop</p>
          ${body.split("\n").map((line) => `<p style="margin: 8px 0;">${line}</p>`).join("")}
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

  // ── get_pending_emails ─────────────────────────────────────────────────────
  if (name === "get_pending_emails") {
    const { data } = await supabaseAdmin
      .from("figaro_messages")
      .select("id, from_name, from_email, message, created_at")
      .eq("escalated", true)
      .order("created_at", { ascending: false }).limit(5);
    if (!data?.length) return "Aucun email en attente d'approbation. ✅";
    return data.map((d) =>
      `• [${(d.id as string).slice(0, 8)}] ${d.from_name} <${d.from_email}>\n  ${String(d.message).replace(/^.*\|\|\|/, "").slice(0, 100)}...`
    ).join("\n\n");
  }

  // ── system_status (crons + alertes récentes) ───────────────────────────────
  if (name === "system_status") {
    const [crons, alerts] = await Promise.all([
      supabaseAdmin.from("cron_executions")
        .select("cron_name, status, started_at, duration_ms, detail")
        .order("started_at", { ascending: false }).limit(8),
      supabaseAdmin.from("sms_log")
        .select("message_type, message_preview, sent_at")
        .in("message_type", ["fb-token-alert", "system-alert"])
        .order("sent_at", { ascending: false }).limit(5),
    ]);
    let out = "<b>🩺 Derniers crons :</b>\n";
    if (crons.data?.length) {
      out += (crons.data as { cron_name: string; status: string; started_at: string; duration_ms?: number }[])
        .map((c) => {
          const icon = c.status === "ok" ? "✅" : c.status === "error" ? "🔴" : "⏳";
          const when = new Date(c.started_at).toLocaleString("fr-CA", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          return `${icon} ${c.cron_name} — ${when}${c.duration_ms ? ` (${c.duration_ms}ms)` : ""}`;
        }).join("\n");
    } else out += "Aucune exécution récente.";
    if (alerts.data?.length) {
      out += "\n\n<b>⚠️ Alertes récentes :</b>\n" +
        (alerts.data as { message_type: string; message_preview: string; sent_at: string }[])
          .map((a) => `• ${a.message_preview || a.message_type}`).join("\n");
    }
    return out;
  }

  // ── get_holidays ───────────────────────────────────────────────────────────
  if (name === "get_holidays") {
    const days = (input.days as number) || 30;
    const upcoming = getUpcomingHolidays(days);
    if (!upcoming.length) return `Aucun jour férié dans les ${days} prochains jours.`;
    return `Jours fériés QC (${days} prochains jours) :\n\n` +
      upcoming.map((h) => `${h.emoji} ${h.date} — ${h.name}`).join("\n");
  }

  // ── set_reminder ───────────────────────────────────────────────────────────
  if (name === "set_reminder") {
    const message = input.message as string;
    const remindAt = input.remind_at as string;
    if (!message) return "Message du rappel manquant.";
    if (!remindAt) return "Date/heure du rappel manquante.";

    let dt: string;
    if (remindAt.includes("T")) dt = remindAt;
    else if (remindAt.includes(" ")) dt = remindAt.replace(" ", "T") + ":00";
    else dt = remindAt + "T00:00:00";
    if (isNaN(new Date(dt).getTime())) return `Date/heure de rappel pas comprise : "${remindAt}" (attendu "YYYY-MM-DD HH:MM").`;

    const { error } = await supabaseAdmin.from("reminders").insert({
      chat_id: chatId, message, remind_at: dt, done: false,
    });
    if (error) return `Erreur : ${error.message}`;
    const label = new Date(dt).toLocaleString("fr-CA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `⏰ Reminder créé : "${message}" → ${label}`;
  }

  // ── save_note / get_notes ──────────────────────────────────────────────────
  if (name === "save_note") {
    const key = input.key as string;
    const content = input.content as string;
    if (!key || !content) return "Clé ou contenu manquant.";
    await supabaseAdmin.from("figaro_notes").upsert(
      { key, content, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return `✅ Note sauvegardée : "${key}"`;
  }

  if (name === "get_notes") {
    const { data } = await supabaseAdmin
      .from("figaro_notes").select("key, content, updated_at").order("updated_at", { ascending: false });
    if (!data?.length) return "Aucune note sauvegardée.";
    return data.map((n) => `📝 <b>${n.key}</b>\n${n.content}`).join("\n\n");
  }

  // ── create_post ────────────────────────────────────────────────────────────
  if (name === "create_post") {
    const topic = input.topic as string | undefined;
    const kind = (input.kind as string | undefined) || "custom";
    try {
      const content = await generatePost(kind, topic);
      const { data: row, error: insertError } = await supabaseAdmin
        .from("pending_posts").insert({ content, kind, status: "pending" }).select("id").single();
      if (insertError || !row) return `❌ Erreur création: ${insertError?.message || "inconnu"}`;
      await proposePostOnTelegram({ id: row.id as string, content, kind });
      return "📢 Proposition envoyée, regarde plus haut pour approuver.";
    } catch (e) {
      return `❌ Erreur: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return "Outil inconnu.";
}

// ── Tool schemas ───────────────────────────────────────────────────────────────
function buildTools(): Anthropic.Tool[] {
  const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
    type: "object" as const, properties, required,
  });
  return [
    { name: "get_bookings", description: "RDV pour une période et/ou un barbier",
      input_schema: obj({ period: { type: "string", enum: ["today", "tomorrow", "this_week", "next_week", "last_week"] }, barber: { type: "string" }, date: { type: "string", description: "date FR ou YYYY-MM-DD" } }) },
    { name: "check_availability", description: "Créneaux libres réels d'un jour (par barbier/service)",
      input_schema: obj({ date: { type: "string", description: "date FR ou YYYY-MM-DD" }, barber: { type: "string" }, service: { type: "string" } }, ["date"]) },
    { name: "get_revenue", description: "Revenus par période",
      input_schema: obj({ period: { type: "string", enum: ["today", "this_week", "last_week", "this_month"] } }, ["period"]) },
    { name: "search_client", description: "Recherche rapide d'un client par nom",
      input_schema: obj({ name: { type: "string" } }, ["name"]) },
    { name: "get_client_history", description: "Historique complet d'un client (visites, montants, prochain RDV)",
      input_schema: obj({ query: { type: "string", description: "nom, téléphone ou email" } }, ["query"]) },
    { name: "create_booking", description: "Crée un RDV. Service validé via la table services (jamais inventé).",
      input_schema: obj({ client_name: { type: "string" }, client_phone: { type: "string" }, client_email: { type: "string" }, service: { type: "string" }, barber: { type: "string" }, date: { type: "string", description: "date FR ou YYYY-MM-DD" }, time: { type: "string", description: "HH:MM" }, price: { type: "number" }, note: { type: "string" } }, ["client_name", "service", "barber", "date", "time"]) },
    { name: "update_booking", description: "Modifie un RDV existant (service/barbier/prix/note/statut/date/heure). Changement de PRIX exige confirmed:true.",
      input_schema: obj({ id: { type: "string" }, service: { type: "string" }, barber: { type: "string" }, price: { type: "number" }, note: { type: "string" }, status: { type: "string", enum: ["confirmed", "completed", "cancelled", "no_show", "pending"] }, date: { type: "string" }, time: { type: "string" }, client_name: { type: "string" }, client_phone: { type: "string" }, client_email: { type: "string" }, confirmed: { type: "boolean", description: "true SEULEMENT après OUI de l'humain (changement de prix)" } }, ["id"]) },
    { name: "reschedule_booking", description: "Déplace un RDV à une nouvelle date/heure",
      input_schema: obj({ id: { type: "string" }, new_date: { type: "string" }, new_time: { type: "string" } }, ["id", "new_date", "new_time"]) },
    { name: "cancel_booking", description: "Annule un RDV (DESTRUCTIF). Cherche d'abord, récapitule, puis confirmed:true après OUI.",
      input_schema: obj({ id: { type: "string" }, confirmed: { type: "boolean", description: "true SEULEMENT après OUI de l'humain" } }, ["id"]) },
    { name: "block_barber_day", description: "Bloque un barbier (journée complète ou plage start_time-end_time)",
      input_schema: obj({ barber: { type: "string" }, date: { type: "string" }, reason: { type: "string" }, start_time: { type: "string", description: "HH:MM optionnel" }, end_time: { type: "string", description: "HH:MM optionnel" } }, ["barber", "date"]) },
    { name: "unblock_barber_day", description: "Retire les blocages d'un barbier pour une date",
      input_schema: obj({ barber: { type: "string" }, date: { type: "string" } }, ["barber", "date"]) },
    { name: "set_barber_override", description: "Horaire exceptionnel d'un barbier pour une date précise",
      input_schema: obj({ barber: { type: "string" }, date: { type: "string" }, open: { type: "string", description: "HH:MM" }, close: { type: "string", description: "HH:MM" } }, ["barber", "date", "open", "close"]) },
    { name: "get_blocks", description: "Blocages à venir (tous ou par barbier)",
      input_schema: obj({ barber: { type: "string" } }) },
    { name: "list_barbers", description: "Liste les barbiers et leurs horaires",
      input_schema: obj({}) },
    { name: "list_services", description: "Liste les services et prix officiels",
      input_schema: obj({}) },
    { name: "upsert_service", description: "Ajoute ou modifie un service. Donner un prix exige confirmed:true (action sensible).",
      input_schema: obj({ name: { type: "string" }, price: { type: "number" }, duration_min: { type: "number" }, description: { type: "string" }, confirmed: { type: "boolean", description: "true SEULEMENT après OUI de l'humain" } }, ["name"]) },
    { name: "delete_service", description: "Supprime un service (DESTRUCTIF → confirmed:true après OUI)",
      input_schema: obj({ name: { type: "string" }, confirmed: { type: "boolean" } }, ["name"]) },
    { name: "add_expense", description: "Ajoute une dépense",
      input_schema: obj({ description: { type: "string" }, amount: { type: "number" }, category: { type: "string", enum: ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"] }, date: { type: "string" } }, ["description", "amount"]) },
    { name: "send_sms", description: "Envoie un SMS à un client (SORTANT → confirmed:true après OUI)",
      input_schema: obj({ phone: { type: "string" }, message: { type: "string" }, confirmed: { type: "boolean", description: "true SEULEMENT après OUI de l'humain" } }, ["phone", "message"]) },
    { name: "send_email", description: "Envoie un email à un client (SORTANT → confirmed:true après OUI)",
      input_schema: obj({ to_email: { type: "string" }, to_name: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, confirmed: { type: "boolean", description: "true SEULEMENT après OUI de l'humain" } }, ["to_email", "subject", "body"]) },
    { name: "get_pending_emails", description: "Emails clients en attente d'approbation",
      input_schema: obj({}) },
    { name: "system_status", description: "Derniers crons exécutés + alertes système récentes",
      input_schema: obj({}) },
    { name: "get_holidays", description: "Prochains jours fériés QC",
      input_schema: obj({ days: { type: "number" } }) },
    { name: "set_reminder", description: "Crée un rappel Telegram",
      input_schema: obj({ message: { type: "string" }, remind_at: { type: "string", description: "YYYY-MM-DD HH:MM" } }, ["message", "remind_at"]) },
    { name: "save_note", description: "Sauvegarde une info persistante sur Melynda/Luca/le salon",
      input_schema: obj({ key: { type: "string" }, content: { type: "string" } }, ["key", "content"]) },
    { name: "get_notes", description: "Affiche toutes les notes mémorisées",
      input_schema: obj({}) },
    { name: "create_post", description: "Génère un post Facebook et l'envoie sur Telegram pour approbation",
      input_schema: obj({ topic: { type: "string" }, kind: { type: "string", enum: ["tip", "service_highlight", "product", "client_appreciation", "news_seasonal", "promotion", "custom"] } }) },
  ];
}

function needsSonnet(msg: string): boolean {
  const complexPatterns = /crée|réserve|book|nouveau rdv|annule|modifi|pourquoi|analys|expliq|conseil|idée|suggère|note|souviens|retiens|compare|tendance|prix|service|bloque/i;
  return complexPatterns.test(msg) || msg.length > 200;
}

// ────────────────────────────────────────────────────────────────────────────
// B) MOTEUR AGENTIQUE — personnalité Figaro, boucle gardée (max 6 tours)
// ────────────────────────────────────────────────────────────────────────────
async function handleConversation(chatId: number, userMessage: string): Promise<void> {
  const todayQCStr = todayQC();
  const todayLabel = nowInQC().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const [history, notesData, rdvAujourdhui] = await Promise.all([
    loadHistory(chatId),
    supabaseAdmin.from("figaro_notes").select("key, content").order("updated_at", { ascending: false }).limit(20),
    supabaseAdmin.from("bookings").select("id", { count: "exact" }).eq("date", todayQCStr).neq("status", "cancelled"),
  ]);

  await saveHistory(chatId, "user", userMessage);

  const notes = notesData.data?.map((n) => `• ${n.key}: ${n.content}`).join("\n") || "Aucune note";
  const rdvCount = rdvAujourdhui.count || 0;

  const systemPrompt = `Tu es Figaro ✂️ — l'assistant personnel ADMIN de Melynda (propriétaire) et Luca, Ciseau Noir Barbershop, 375 Boul. des Chutes, Beauport (Québec). Tu gères TOUTE la business depuis Telegram.

TON STYLE:
— Québécois naturel, concis, direct. Max 4-5 lignes sauf si une liste est nécessaire.
— Pas de "Bien sûr!" / "Absolument!". Réponds et agis.
— T'as une opinion. Si quelque chose cloche, dis-le.
— Quand on te donne une info utile sur le salon/les gens → save_note automatiquement.

AUJOURD'HUI: ${todayLabel}
RDV aujourd'hui: ${rdvCount} confirmés

LE SALON:
— DEUX barbières : Melynda (propriétaire) ET Stéphanie (chaise). Il existe aussi un "Barbier dispo".
— Services et prix = TABLE services (source de vérité). Utilise list_services / l'outil de validation — n'invente JAMAIS un prix ou un service.
— Fermé dimanche + lundi. Tel: (418) 665-5703.

MÉMOIRE PERSISTANTE:
${notes}

RÈGLES CRITIQUES (sécurité production):
→ ACTIONS SENSIBLES = annuler un RDV, envoyer SMS/email à un client, changer un prix (RDV ou service), supprimer un service. Pour CELLES-LÀ : RÉCAPITULE d'abord à l'humain les arguments EXACTS, attends un "OUI" clair, PUIS rappelle l'outil avec confirmed:true et EXACTEMENT les mêmes arguments. Si l'humain change un détail, re-confirme.
→ Si un outil renvoie "ACTION SENSIBLE — NON EXÉCUTÉE", c'est NORMAL : montre le récap, demande OUI, n'invente pas que c'est fait.
→ Services/prix : TOUJOURS via la table (resolveService côté outils). Si un service est inconnu, demande lequel — ne devine pas.
→ Dates : écris-les en clair (demain, samedi, 2026-06-25), les outils comprennent le français. Si une date est refusée comme "pas comprise", reformule, ne passe jamais une date floue.
→ Avant de créer un RDV : besoin de nom + service + barbier + date + heure. Vérifie check_availability pour éviter les doublons.
→ Pour annuler/déplacer : cherche d'abord (search_client), confirme le bon RDV, puis agis.
→ Ne donne jamais un chiffre/dispo/prix sans l'avoir obtenu d'un outil. Aucune hallucination de résultat.

Tu réponds à TOUT (questions, gestion, conseils) — t'es l'assistant complet de la business.`;

  const tools = buildTools();
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userMessage }];
  const model = needsSonnet(userMessage) ? MODEL_SMART : MODEL_FAST;

  try {
    let reply = "";
    let lastSig = "";

    for (let turn = 0; turn < 6; turn++) {
      const response = await createWithFallback({
        model, max_tokens: 1024, system: systemPrompt, tools, messages,
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (textBlock) reply = textBlock.text;

      if (response.stop_reason !== "tool_use") break;

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break;

      // Garde-fou anti-boucle : même outil + mêmes args 2× de suite → on casse.
      const sig = toolUses.map((t) => `${t.name}:${JSON.stringify(t.input)}`).join("|");
      if (sig === lastSig) {
        reply = reply || "Je tourne en rond sur cette action — précise ou reformule.";
        break;
      }
      lastSig = sig;

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const t of toolUses) {
        const result = await executeTool(t.name, t.input as Record<string, unknown>, chatId);
        results.push({ type: "tool_result", tool_use_id: t.id, content: result });
      }
      messages.push({ role: "user", content: results });
    }

    if (!reply) reply = "Je t'entends mais j'arrive pas à formuler. Reformule et réessaie.";
    await saveHistory(chatId, "assistant", reply);
    await sendTelegramMessage(chatId, reply);
  } catch (e) {
    console.error("Conversation error:", e);
    await sendTelegramMessage(chatId, "🔴 Erreur technique — réessaie dans une seconde.");
  }
}

// ── E) Photo receipt handler — confirmation avant INSERT si montant >200$ ou confidence ≠ high ──
async function handlePhotoReceipt(chatId: number, fileId: string, caption?: string): Promise<void> {
  await sendTelegramMessage(chatId, "📸 Photo reçue — j'analyse le reçu...");

  try {
    const fileRes = await fetch(`${TELEGRAM_API}${getToken()}/getFile?file_id=${fileId}`);
    const fileData = (await fileRes.json()) as { ok: boolean; result: { file_path: string } };
    if (!fileData.ok) { await sendTelegramMessage(chatId, "❌ Impossible de télécharger la photo."); return; }

    const imgUrl = `https://api.telegram.org/file/bot${getToken()}/${fileData.result.file_path}`;
    const imgRes = await fetch(imgUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = fileData.result.file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    const rawText = await generateText({
      model: MODELS.FAST,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
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
Date d'aujourd'hui si pas visible sur le reçu: ${todayQC()}`,
          },
        ],
      }],
    });

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { await sendTelegramMessage(chatId, "❌ Pas de reçu reconnu dans cette photo."); return; }

    const expense = JSON.parse(jsonMatch[0]) as {
      description: string; amount: number; category: string; date: string; store?: string; confidence: string;
    };

    if (expense.confidence === "low" || !expense.amount) {
      await sendTelegramMessage(chatId, `⚠️ Je vois un reçu mais le montant est flou.\n\nDis-moi : "Ajoute dépense: [description] [montant]$"`);
      return;
    }

    const validCategories = ["Fournitures", "Équipement", "Loyer", "Marketing", "Employés", "Services", "Autre"];
    const finalCategory = validCategories.includes(expense.category) ? expense.category : "Autre";
    const expDate = parseDate(expense.date) || todayQC();
    const storeNote = expense.store ? ` — ${expense.store}` : "";

    // CONFIRMATION avant INSERT si montant élevé (>200$) OU confidence pas "high".
    const needsConfirmation = expense.amount > 200 || expense.confidence !== "high";

    if (needsConfirmation) {
      await fetch(`${TELEGRAM_API}${getToken()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, parse_mode: "HTML",
          text: `🧾 <b>Reçu à confirmer</b>${storeNote}\n\n` +
            `📋 ${expense.description}\n💰 <b>${expense.amount}$</b>\n📁 ${finalCategory}\n📅 ${expDate}\n` +
            `<i>Confiance : ${expense.confidence}${expense.amount > 200 ? " · montant élevé" : ""}</i>\n\nC'est correct ?`,
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Oui, enregistre", callback_data: `exp_ok:${expense.amount}:${finalCategory}:${expDate}:${expense.description.slice(0, 40)}` },
              { text: "❌ Non", callback_data: `exp_no:x` },
            ]],
          },
        }),
      });
      return;
    }

    await supabaseAdmin.from("expenses").insert({
      description: expense.description, amount: expense.amount, category: finalCategory, date: expDate,
    });
    await sendTelegramMessage(chatId,
      `✅ <b>Dépense ajoutée</b>${storeNote}\n\n📋 ${expense.description}\n💰 ${expense.amount}$\n📁 ${finalCategory}\n📅 ${expDate}\n\n` +
      `<i>Si c'est pas exact, dis "Corrige la dernière dépense: [correction]"</i>`
    );
  } catch (e) {
    console.error("Photo receipt error:", e);
    await sendTelegramMessage(chatId, "❌ Erreur lors de l'analyse. Essaie une photo plus nette ou ajoute la dépense manuellement.");
  }
}

// ── Reminder callback handler ──────────────────────────────────────────────────
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

// ── Expense receipt confirmation callback ──────────────────────────────────────
async function handleExpenseCallback(callbackId: string, data: string, chatId: number, messageId: number): Promise<void> {
  await answerCallback(callbackId);
  if (data.startsWith("exp_no:")) {
    await editMessage(chatId, messageId, "❌ Reçu ignoré — rien enregistré.");
    return;
  }
  // exp_ok:amount:category:date:description
  const parts = data.split(":");
  const amount = Number(parts[1]);
  const category = parts[2] || "Autre";
  const date = parts[3] || todayQC();
  const description = parts.slice(4).join(":") || "Dépense";
  if (!Number.isFinite(amount) || amount <= 0) {
    await editMessage(chatId, messageId, "❌ Montant invalide — non enregistré.");
    return;
  }
  const { error } = await supabaseAdmin.from("expenses").insert({ description, amount, category, date });
  await editMessage(chatId, messageId, error
    ? `🔴 Erreur : ${error.message}`
    : `✅ Dépense enregistrée : ${description} — ${amount}$ (${category}) le ${date}`);
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN WEBHOOK
// ────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  // FULL ACCESS (choix du propriétaire) — aucune barrière d'authentification sur le webhook.
  // Le bot répond à tout, sans secret ni allowlist. Les confirmations restent sur les actions
  // destructives/sortantes (anti-erreur de l'IA), pas pour bloquer l'accès.
  try {
    const update = await req.json();

    // Idempotence : Telegram re-livre un update si on ne répond pas 200 à temps (ex: traitement IA long).
    // On enregistre update_id (clé primaire) — si déjà vu → on ignore (évite double-action / double-booking).
    const updateId = update?.update_id;
    if (typeof updateId === "number") {
      const { error: dupErr } = await supabaseAdmin.from("telegram_updates").insert({ update_id: updateId });
      if (dupErr) return NextResponse.json({ ok: true }); // déjà traité → idempotent
    }

    // ── Callback buttons (approval + reminders + receipts + posts) ─────────────
    if (update.callback_query) {
      const { id, data, message } = update.callback_query as {
        id: string; data?: string; message: { chat: { id: number }; message_id: number };
      };

      if (data && data.includes("_REMIND_")) {
        await handleReminderCallback(id, data, message.chat.id, message.message_id);
        return NextResponse.json({ ok: true });
      }

      if (data && (data.startsWith("exp_ok:") || data.startsWith("exp_no:"))) {
        await handleExpenseCallback(id, data, message.chat.id, message.message_id);
        return NextResponse.json({ ok: true });
      }

      if (data && (data.startsWith("post_pub:") || data.startsWith("post_regen:") || data.startsWith("post_rej:"))) {
        await answerCallback(id);
        const colonIdx = data.indexOf(":");
        const action = data.slice(0, colonIdx);
        const postId = data.slice(colonIdx + 1);

        const { data: postRow, error: postErr } = await supabaseAdmin
          .from("pending_posts").select("id, content, kind, status").eq("id", postId).single();

        if (postErr || !postRow) {
          await editMessage(message.chat.id, message.message_id, "❌ Publication introuvable (peut-être déjà traitée).");
          return NextResponse.json({ ok: true });
        }

        if (action === "post_pub") {
          const { data: claimed } = await supabaseAdmin
            .from("pending_posts").update({ status: "posting" }).eq("id", postId).eq("status", "pending").select("id");
          if (!claimed || claimed.length === 0) {
            await editMessage(message.chat.id, message.message_id, "✅ Déjà publié (rien fait en double).");
            return NextResponse.json({ ok: true });
          }
          const result = await publishPostToFacebook(postRow.content as string);
          if (result.error) {
            await supabaseAdmin.from("pending_posts").update({ status: "pending" }).eq("id", postId);
            await editMessage(message.chat.id, message.message_id, `❌ Erreur Facebook : ${result.error}`);
          } else {
            const isPromo = (postRow.kind as string) === "promotion";
            const expiresAt = isPromo ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
            await supabaseAdmin.from("pending_posts").update({
              status: "posted", fb_post_id: result.id ?? null, ...(expiresAt ? { expires_at: expiresAt } : {}),
            }).eq("id", postId);
            await editMessage(message.chat.id, message.message_id, `✅ Publié sur Facebook !`);
          }
        } else if (action === "post_regen") {
          try {
            const newContent = await generatePost(postRow.kind as string);
            await supabaseAdmin.from("pending_posts").update({ content: newContent }).eq("id", postId);
            await proposePostOnTelegram({ id: postId, content: newContent, kind: postRow.kind as string });
            await editMessage(message.chat.id, message.message_id, "🔄 Nouvelle proposition envoyée ci-dessus.");
          } catch (e) {
            await editMessage(message.chat.id, message.message_id, `❌ Erreur régénération : ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (action === "post_rej") {
          await supabaseAdmin.from("pending_posts").update({ status: "rejected" }).eq("id", postId);
          await editMessage(message.chat.id, message.message_id, "❌ Rejeté, rien publié.");
        }

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
      if (update.message.from?.is_bot) return NextResponse.json({ ok: true });

      const chatId = update.message.chat.id as number;
      const rawText = (update.message.text as string).trim();
      const text = stripBotMention(rawText);

      if (text === "/start" || text === "/aide" || text === "/help") {
        await sendTelegramMessage(chatId,
          `✂️ <b>Figaro — ton assistant ADMIN Ciseau Noir</b>\n\n` +
          `Je gère toute la business. Parle-moi normalement :\n\n` +
          `<b>📅 Agenda</b> — "RDV de demain", "Agenda Stéphanie samedi", "Book Marie samedi 10h Melynda coupe", "Déplace le RDV de Tremblay à lundi 14h", "Annule le RDV de Jean"\n\n` +
          `<b>💰 Finance</b> — "On a fait combien cette semaine?", "Ajoute dépense: Wahl 89$", 📸 photo de reçu\n\n` +
          `<b>✂️ Services/prix</b> — "Liste les services", "Change le prix du Premium à 80$"\n\n` +
          `<b>👥 Barbiers</b> — "Bloque Stéphanie lundi", "Bloque Melynda vendredi 13h-15h", "Horaire spécial Melynda samedi 9h-14h"\n\n` +
          `<b>📨 Clients</b> — "Historique de Tremblay", "Envoie un SMS à Marie...", "Email à jean@email.com..."\n\n` +
          `<b>🩺 Système</b> — "État des crons", "Des alertes?"\n\n` +
          `<i>Les actions sensibles (annuler, SMS/email, prix) demandent ton OUI avant.</i>\n\n` +
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

      await handleConversation(chatId, text);
    }

    // ── Photo messages (receipt scanning) ──────────────────────────────────────
    if (update.message?.photo) {
      if (update.message.from?.is_bot) return NextResponse.json({ ok: true });
      const chatId = update.message.chat.id as number;
      const caption = (update.message.caption as string | undefined) || "";
      const photos = update.message.photo as { file_id: string; width: number }[];
      const bestPhoto = photos[photos.length - 1];
      await handlePhotoReceipt(chatId, bestPhoto.file_id, caption);
    }
  } catch (e) {
    console.error("Telegram webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}
