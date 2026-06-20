/**
 * Telegram notification service — Ciseau Noir Ops
 * Envoie des alertes intelligentes dans le groupe Telegram de Luca + Melynda.
 * Filtre le bruit : seulement ce qui nécessite attention ou information utile.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function getChatId() {
  return process.env.TELEGRAM_GROUP_CHAT_ID || "";
}

function isConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_GROUP_CHAT_ID);
}

async function sendMessage(text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}${getToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: getChatId(),
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "short", day: "numeric", month: "short",
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

/** Nouveau RDV créé (client ou admin) */
export async function notifyNewBooking(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  price: number;
  source?: string;
}) {
  const sourceIcon = booking.source === "google" ? "🔍" : booking.source === "facebook" ? "📘" : booking.source === "instagram" ? "📸" : booking.source === "messenger" ? "💬" : "🌐";
  await sendMessage(
    `✂️ <b>Nouveau RDV</b> ${sourceIcon}\n\n` +
    `👤 ${booking.client_name}\n` +
    `📞 ${booking.client_phone}\n` +
    `💈 ${booking.service} — ${booking.price}$\n` +
    `👨‍💼 ${booking.barber}\n` +
    `📅 ${formatDate(booking.date)} à ${booking.time}`
  );
}

/** RDV annulé */
export async function notifyBookingCancelled(booking: {
  client_name: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  await sendMessage(
    `❌ <b>RDV annulé</b>\n\n` +
    `👤 ${booking.client_name}\n` +
    `💈 ${booking.service} — ${booking.barber}\n` +
    `📅 ${formatDate(booking.date)} à ${booking.time}\n\n` +
    `<i>Slot maintenant disponible</i>`
  );
}

/** RDV modifié (heure/date changée) */
export async function notifyBookingRescheduled(booking: {
  client_name: string;
  service: string;
  barber: string;
  old_date: string;
  old_time: string;
  new_date: string;
  new_time: string;
}) {
  await sendMessage(
    `🔄 <b>RDV déplacé</b>\n\n` +
    `👤 ${booking.client_name} — ${booking.service}\n` +
    `👨‍💼 ${booking.barber}\n` +
    `<s>${formatDate(booking.old_date)} à ${booking.old_time}</s>\n` +
    `→ ${formatDate(booking.new_date)} à ${booking.new_time}`
  );
}

/** No-show détecté */
export async function notifyNoShow(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  await sendMessage(
    `👻 <b>No-show</b>\n\n` +
    `👤 ${booking.client_name} (${booking.client_phone})\n` +
    `💈 ${booking.service} — ${booking.barber}\n` +
    `📅 ${formatDate(booking.date)} à ${booking.time}\n\n` +
    `<i>SMS de relance envoyé au client</i>`
  );
}

/** Résumé quotidien : RDV passés encore non marqués (1 SEUL message, pas de spam) */
export async function notifyNoShowDigest(bookings: {
  client_name: string;
  time: string;
  barber: string;
  service: string;
}[]) {
  if (!bookings.length) return;
  const lines = bookings
    .map(b => `• ${b.time} — ${b.client_name} (${b.barber}) · ${b.service}`)
    .join("\n");
  const n = bookings.length;
  await sendMessage(
    `🕐 <b>RDV à vérifier — no-show ?</b>\n\n` +
    `${n} rendez-vous passé${n > 1 ? "s" : ""} pas encore marqué${n > 1 ? "s" : ""} :\n\n` +
    `${lines}\n\n` +
    `<i>Ouvre l'agenda et clique « No-show » si le client ne s'est pas présenté, sinon « Complété ».</i>`
  );
}

/** Message client reçu — escalade (Figaro ne peut pas répondre seul) */
export async function notifyEscalation(opts: {
  from_name: string;
  from_email: string;
  message: string;
  ai_response?: string;
  source?: "email" | "contact_form" | "messenger";
}) {
  const sourceLabel = opts.source === "email" ? "📧 Email" : opts.source === "messenger" ? "💬 Messenger" : "📝 Formulaire";
  const preview = opts.message.length > 200 ? opts.message.slice(0, 197) + "..." : opts.message;
  const aiNote = opts.ai_response ? `\n\n🤖 <i>Réponse auto envoyée</i>` : `\n\n⚠️ <b>Réponse manuelle requise</b>`;
  await sendMessage(
    `🚨 <b>Message client — ${sourceLabel}</b>\n\n` +
    `👤 ${opts.from_name} (${opts.from_email})\n\n` +
    `"${preview}"` +
    aiNote
  );
}

/** Rapport quotidien (envoyé à 21h par le cron) */
export async function sendDailyReport(report: {
  date: string;
  bookings_today: number;
  revenue_today: number;
  bookings_tomorrow: number;
  revenue_week: number;
  low_twilio_balance?: boolean;
  twilio_balance?: number;
}) {
  const balanceWarning = report.low_twilio_balance
    ? `\n\n⚠️ <b>Twilio bas :</b> ${report.twilio_balance?.toFixed(2)}$ — recharger bientôt`
    : "";
  await sendMessage(
    `📊 <b>Résumé du ${formatDate(report.date)}</b>\n\n` +
    `Aujourd'hui : <b>${report.bookings_today} RDV</b> — ${report.revenue_today}$\n` +
    `Demain : <b>${report.bookings_tomorrow} RDV</b> prévus\n` +
    `Cette semaine : <b>${report.revenue_week}$</b> de revenus` +
    balanceWarning
  );
}

/** Rapport hebdomadaire (dimanche soir) */
export async function sendWeeklyReport(report: {
  week_label: string;
  total_bookings: number;
  total_revenue: number;
  top_service: string;
  new_clients: number;
  completed: number;
  cancelled: number;
  no_shows: number;
}) {
  await sendMessage(
    `📈 <b>Rapport semaine — ${report.week_label}</b>\n\n` +
    `✅ ${report.total_bookings} RDV — <b>${report.total_revenue}$</b>\n` +
    `🆕 ${report.new_clients} nouveaux clients\n` +
    `🏆 Service top : ${report.top_service}\n\n` +
    `Complétés : ${report.completed} | Annulés : ${report.cancelled} | No-shows : ${report.no_shows}`
  );
}

/** Alerte santé système (Twilio/Supabase down) */
export async function notifySystemAlert(message: string) {
  await sendMessage(`🔴 <b>Alerte système</b>\n\n${message}`);
}

/** Alerte Twilio balance faible */
export async function notifyLowTwilioBalance(balance: number) {
  await sendMessage(
    `⚠️ <b>Twilio — solde bas</b>\n\n` +
    `Solde actuel : <b>${balance.toFixed(2)}$</b>\n` +
    `Recharger pour éviter des interruptions SMS : https://console.twilio.com`
  );
}

/** Nouvelle liste d'attente */
export async function notifyWaitlistEntry(entry: {
  client_name: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  await sendMessage(
    `⏳ <b>Liste d'attente</b>\n\n` +
    `👤 ${entry.client_name} attend un slot\n` +
    `💈 ${entry.service} — ${entry.barber}\n` +
    `📅 ${formatDate(entry.date)} à ${entry.time}`
  );
}

/** Message du formulaire contact */
export async function notifyNewContactMessage(opts: {
  name: string;
  email: string;
  message: string;
  escalated: boolean;
}) {
  const icon = opts.escalated ? "🚨" : "✉️";
  await sendMessage(
    `${icon} <b>Message contact${opts.escalated ? " — ESCALADE" : ""}</b>\n\n` +
    `👤 ${opts.name}\n` +
    `📧 ${opts.email}\n\n` +
    `💬 ${opts.message.slice(0, 300)}${opts.message.length > 300 ? "..." : ""}`
  );
}

/** Commentaire FB qui mérite un suivi humain (question/demande) — heads-up calme, pas une alerte rouge */
export async function notifyFbComment(opts: {
  author: string;
  message: string;
  reply: string;
}) {
  await sendMessage(
    `💬 <b>Commentaire FB à suivre</b>\n\n` +
    `👤 ${opts.author}\n` +
    `💬 ${opts.message.slice(0, 280)}${opts.message.length > 280 ? "..." : ""}\n\n` +
    `<i>Réponse auto envoyée :</i> ${opts.reply.slice(0, 200)}`
  );
}

/** Proposition de publication Facebook — boutons inline Telegram */
export async function proposePostOnTelegram(opts: {
  id: string;
  content: string;
  kind: string;
}): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const preview =
      opts.content.length > 600
        ? opts.content.slice(0, 597) + "..."
        : opts.content;

    const text =
      `📢 <b>Proposition de publication (${opts.kind}) — approuve, régénère ou rejette</b>\n\n` +
      `${preview}`;

    const res = await fetch(`${TELEGRAM_API}${getToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: getChatId(),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Publier", callback_data: `post_pub:${opts.id}` },
            { text: "🔄 Régénérer", callback_data: `post_regen:${opts.id}` },
            { text: "❌ Rejeter", callback_data: `post_rej:${opts.id}` },
          ]],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Demande d'approbation pour un email important — boutons inline Telegram */
export async function sendEmailApprovalRequest(draft: {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  original_body: string;
  draft_response: string;
}): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const bodyPreview = draft.original_body.length > 300
      ? draft.original_body.slice(0, 297) + "..."
      : draft.original_body;
    const replyPreview = draft.draft_response.length > 500
      ? draft.draft_response.slice(0, 497) + "..."
      : draft.draft_response;

    const hasDraft = draft.draft_response && draft.draft_response.trim().length > 10;
    const text =
      `📧 <b>Email important — ton attention requise</b>\n\n` +
      `<b>De :</b> ${draft.from_name} (${draft.from_email})\n` +
      `<b>Sujet :</b> ${draft.subject}\n\n` +
      `<b>Message :</b>\n${bodyPreview}` +
      (hasDraft ? `\n\n─────────────────────\n<b>Réponse préparée par Figaro :</b>\n${replyPreview}` : `\n\n<i>Appuie ✅ pour archiver ou ❌ pour ignorer</i>`);

    const res = await fetch(`${TELEGRAM_API}${getToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: getChatId(),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approuver", callback_data: `approve_${draft.id}` },
            { text: "❌ Refuser", callback_data: `refuse_${draft.id}` },
          ]],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
