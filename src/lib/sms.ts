import twilio from "twilio";

function getClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

const FROM_NUMBER = () => process.env.TWILIO_PHONE_NUMBER || "";

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
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  await getClient().messages.create({
    from: FROM_NUMBER(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir ✂️ Réservation confirmée !\n\n${booking.service} avec ${booking.barber}\n📅 ${dateFormatted} à ${booking.time}\n📍 375 Bd des Chutes, Québec\n\nAnnulation : 1h avant — (418) 665-5703`,
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
  // Seulement Melynda reçoit les notifications SMS
  if (!booking.barber.toLowerCase().includes("melynda")) return;
  const barberPhoneEnv = process.env.MELYNDA_PHONE;

  if (!barberPhoneEnv) return;

  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  await getClient().messages.create({
    from: FROM_NUMBER(),
    to: formatPhone(barberPhoneEnv),
    body: `✂️ Nouveau RDV !\n\n${booking.client_name} — ${booking.service}\n📅 ${dateFormatted} à ${booking.time}\n📞 ${booking.client_phone}`,
  });
}

export async function sendNoShowSMS(booking: {
  client_name: string;
  client_phone: string;
}) {
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://ciseunoirbarbershop.com"}/booking`;
  await getClient().messages.create({
    from: FROM_NUMBER(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir — Bonjour ${booking.client_name}, vous n'êtes pas venu(e) à votre rendez-vous chez Ciseau Noir. Pour reprendre un RDV : ${bookingUrl}`,
  });
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

  await getClient().messages.create({
    from: FROM_NUMBER(),
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
  const rdvLine = booking.rdv_url ? `\n\nVoir / Modifier : ${booking.rdv_url}` : "";
  await getClient().messages.create({
    from: FROM_NUMBER(),
    to: formatPhone(booking.client_phone),
    body: `Ciseau Noir ✂️ Rappel — demain à ${booking.time} !\n\n${booking.service} avec ${booking.barber}\n📍 375 Bd des Chutes, Québec${rdvLine}`,
  });
}
