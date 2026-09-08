import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * URL du site — .trim() OBLIGATOIRE : un retour à la ligne accidentel dans la
 * variable Vercel (NEXT_PUBLIC_SITE_URL) casse la validation de signature Twilio
 * (le webhook STOP renvoyait alors 403 → les clients ne pouvaient plus se
 * désinscrire) et corrompt les liens dans les SMS. Même précaution que lib/supabase.ts.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com").trim();

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials manquants");
  return twilio(sid, token);
}

function getFromNumber() {
  const num = process.env.TWILIO_PHONE_NUMBER;
  if (!num) throw new Error("TWILIO_PHONE_NUMBER manquant");
  return num;
}

/** Normalise un numéro en 10 chiffres (clé unique de la blacklist et des logs). */
export function phoneKey(phone: string): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * Vérifie si un numéro est désinscrit des SMS.
 * La table `sms_blacklist` ne contient QUE des désinscriptions réelles
 * (client via STOP, ou retrait manuel par Melynda). Le journal winback est
 * dans sa propre table `sms_winback_log` — il ne bloque JAMAIS les envois.
 */
export async function isBlacklisted(phone: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("sms_blacklist")
      .select("phone")
      .eq("phone", phoneKey(phone))
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false; // en cas d'erreur, on envoie quand même
  }
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendBookingConfirmationSMS(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  booking_id?: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  const siteUrl = SITE_URL;
  const calendarLine = booking.booking_id
    ? `\n📆 Agenda : ${siteUrl}/api/calendar/booking/${booking.booking_id}`
    : "";
  // Lien direct vers l'annulation/modification en libre-service (déjà en place sur le site) —
  // le client n'a plus besoin d'appeler juste pour annuler. Fallback téléphone si jamais
  // pas d'ID (ne devrait pas arriver, mais on ne laisse jamais un client sans façon d'annuler).
  const manageLine = booking.booking_id
    ? `\n🔗 Annuler/modifier : ${siteUrl}/booking/rdv/${booking.booking_id}`
    : `\n\nAnnulation : 1h avant — (418) 665-5703`;

  if (await isBlacklisted(booking.client_phone)) return;
  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir ✂️ Réservation confirmée !\n\n${booking.service} avec ${booking.barber}\n📅 ${dateFormatted} à ${booking.time}\n📍 2275 Avenue Royale, Québec${calendarLine}${manageLine}`,
  });
}

export async function sendBarberNotificationSMS(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  // Chaque barbier reçoit le SMS sur SON numéro (colonne phone de la table barbers).
  // Si le barbier n'a pas de numéro (ex: Barbier dispo) → fallback sur Melynda (propriétaire).
  let barberPhone: string | undefined;
  try {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const { data: barbers } = await supabaseAdmin.from("barbers").select("name, phone");
    const match = (barbers || []).find((b: { name: string; phone?: string | null }) => norm(b.name) === norm(booking.barber));
    if (match?.phone) barberPhone = match.phone;
  } catch { /* lookup non bloquant */ }
  if (!barberPhone) barberPhone = process.env.MELYNDA_PHONE;
  if (!barberPhone) return;

  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(barberPhone),
    body: `✂️ Nouveau RDV !\n\n${booking.client_name} — ${booking.service}\n📅 ${dateFormatted} à ${booking.time}\n📞 ${booking.client_phone}`,
  });
}

export async function sendNoShowSMS(booking: {
  client_name: string;
  client_phone: string;
}) {
  if (await isBlacklisted(booking.client_phone)) return;
  const bookingUrl = `${SITE_URL}/booking`;
  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir — Bonjour ${booking.client_name}, vous n'êtes pas venu(e) à votre rendez-vous chez Ciseau Noir. Pour reprendre un RDV : ${bookingUrl}`,
  });
}

/**
 * Avertit le BARBIER CONCERNÉ (pas juste le groupe Telegram général) qu'un de SES
 * rendez-vous a été annulé — demande Melynda, 3 sept 2026 : Stéphanie ne suivait pas
 * le fil Telegram et ratait les annulations de ses propres clients.
 */
export async function sendBarberCancellationSMS(booking: {
  client_name: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  let barberPhone: string | undefined;
  try {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const { data: barbers } = await supabaseAdmin.from("barbers").select("name, phone");
    const match = (barbers || []).find((b: { name: string; phone?: string | null }) => norm(b.name) === norm(booking.barber));
    if (match?.phone) barberPhone = match.phone;
  } catch { /* lookup non bloquant */ }
  if (!barberPhone) barberPhone = process.env.MELYNDA_PHONE;
  if (!barberPhone) return;

  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  // Type unique par créneau (pas un type fixe) : sinon deux annulations différentes le
  // même jour pour le même barbier seraient bloquées par le dédup 24h de sendSMS.
  await sendSMS(
    barberPhone,
    `❌ RDV annulé\n\n${booking.client_name} — ${booking.service}\n📅 ${dateFormatted} à ${booking.time}\n\nCe créneau est maintenant libre.`,
    `barber_cancellation_${booking.date}_${booking.time}`
  );
}

/**
 * SMS envoyé au client APRÈS clic « Oui » sur Telegram — jamais automatique
 * (demande Melynda, 3 sept 2026). Voir proposeRescheduleNotification dans lib/telegram.
 */
export async function sendRescheduleSMS(booking: {
  client_phone: string;
  service: string;
  barber: string;
  new_date: string;
  new_time: string;
  booking_id?: string;
}) {
  const dateFormatted = new Date(booking.new_date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });
  const siteUrl = SITE_URL;
  const manageLine = booking.booking_id ? `\n🔗 Voir/annuler : ${siteUrl}/booking/rdv/${booking.booking_id}` : "";

  if (await isBlacklisted(booking.client_phone)) return;
  await sendSMS(
    booking.client_phone,
    `Ciseau Noir ✂️ Ton rendez-vous a été déplacé !\n\n${booking.service} avec ${booking.barber}\n📅 Nouveau : ${dateFormatted} à ${booking.new_time}${manageLine}\n\nDes questions ? (418) 665-5703`,
    "reschedule_notice",
    booking.booking_id
  );
}

export async function sendConfirmationReminderSMS(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  booking_id: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  if (await isBlacklisted(booking.client_phone)) return;
  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(booking.client_phone),
    body: `Rappel: Vous avez un RDV chez Ciseau Noir dans 2 jours (${dateFormatted} à ${booking.time}). Répondez CONFIRMER pour confirmer ou ANNULER pour annuler.`,
  });
}

export async function sendReminderSMS(booking: {
  client_name: string;
  client_phone: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  booking_id: string;
  rdv_url?: string;
}) {
  if (await isBlacklisted(booking.client_phone)) return;
  const rdvLine = booking.rdv_url ? `\n\nVoir / Modifier : ${booking.rdv_url}` : "";
  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir ✂️ Rappel — demain à ${booking.time} !\n\n${booking.service} avec ${booking.barber}\n📍 2275 Avenue Royale, Québec${rdvLine}`,
  });
}

/**
 * Vérifie qu'aucun SMS du même type n'a été envoyé à ce numéro dans les dernières heures.
 * Évite les doublons absolus (ex: rebooking envoyé 2 fois si cron retry).
 */
async function wasRecentlySent(phone: string, type: string, hoursBack = 24): Promise<boolean> {
  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("sms_log")
      .select("id")
      .eq("phone", digits)
      .eq("message_type", type)
      .gte("sent_at", since)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function logSMS(phone: string, type: string, preview: string, bookingId?: string) {
  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    await supabaseAdmin.from("sms_log").insert([{
      phone: digits,
      message_type: type,
      message_preview: preview.slice(0, 100),
      booking_id: bookingId || null,
    }]);
  } catch {}
}

/**
 * Generic SMS sender — sends an arbitrary message to any phone number.
 * - Check blacklist STOP automatiquement
 * - Check dedupe par type sur 24h (anti-doublon absolu)
 * - Log dans sms_log pour traçabilité
 */
export async function sendSMS(to: string, message: string, type = "generic", bookingId?: string): Promise<void> {
  if (await isBlacklisted(to)) return; // STOP respecté
  if (await wasRecentlySent(to, type, 24)) return; // Dedup 24h
  await getClient().messages.create({
    from: getFromNumber(),
    to: formatPhone(to),
    body: message,
  });
  await logSMS(to, type, message, bookingId);
}
