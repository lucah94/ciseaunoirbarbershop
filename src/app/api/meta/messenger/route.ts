import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import twilio from "twilio";
import crypto from "crypto";
import { notifyBookingCancelled, notifyBookingRescheduled, notifySystemAlert } from "@/lib/telegram";
import { serviceDuration } from "@/lib/serviceDuration";
import { getFacebookToken, refreshFacebookToken } from "@/lib/fbToken";
import { resolveService } from "@/lib/serviceLookup";
export const dynamic = 'force-dynamic';

// Détecte une erreur d'authentification Facebook (token expiré/invalide) dans une réponse Graph API.
// FB renvoie code 190 / type "OAuthException" / mentions de "access token".
export function isFbAuthError(raw: unknown): boolean {
  let s = "";
  try { s = typeof raw === "string" ? raw : JSON.stringify(raw); } catch { s = String(raw); }
  const low = s.toLowerCase();
  return (
    /"code"\s*:\s*190/.test(s) ||
    low.includes("oauthexception") ||
    low.includes("access token") ||
    low.includes("session has been invalidated") ||
    low.includes("error validating access token")
  );
}

// Alerte "token Facebook mort" — MAIS ne crie PAS au loup sur un hoquet passager.
// Facebook renvoie parfois des erreurs 190/OAuthException temporaires pour un token POURTANT valide.
// Donc on: (1) tente l'auto-réparation (re-dérivation depuis le token System User permanent),
// (2) VÉRIFIE réellement si le token est mort (appel /me), (3) n'alerte QUE s'il est vraiment
// invalide après ça. Anti-spam 3h. → élimine les fausses alarmes "regénérer le token".
export async function alertFbTokenDead() {
  try {
    // 1. Auto-réparation : re-dérive un token de page frais depuis l'ancre permanente.
    await refreshFacebookToken().catch(() => null);

    // 2. Le token (frais) est-il VRAIMENT mort ?
    let reallyDead = false;
    try {
      const token = await getFacebookToken();
      const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id&access_token=${token}`);
      const data = await res.json();
      reallyDead = !res.ok && isFbAuthError(data);
    } catch {
      reallyDead = false; // erreur réseau ≠ token mort → on n'alerte pas
    }
    if (!reallyDead) return; // faux positif ou auto-réparé → silence, aucune fausse alarme.

    // 3. Token réellement invalide (vérifié) ET auto-réparation impossible → vraie alerte.
    const THREE_H = 3 * 60 * 60 * 1000;
    const { data: recent } = await supabase
      .from("sms_log")
      .select("sent_at")
      .eq("message_type", "fb-token-alert")
      .gte("sent_at", new Date(Date.now() - THREE_H).toISOString())
      .limit(1);
    if (recent && recent.length > 0) return; // déjà alerté récemment → on ne spam pas
    await notifySystemAlert(
      "Token Facebook VRAIMENT invalide (vérifié, auto-réparation échouée) — le token System User a peut-être été retiré du bot. À vérifier dans Business Manager."
    );
    await supabase.from("sms_log").insert([
      { phone: "fb-token", message_type: "fb-token-alert", message_preview: "Token FB invalide vérifié — auto-réparation échouée" },
    ]);
  } catch (e) {
    console.error("[Messenger] alertFbTokenDead a échoué:", String(e).slice(0, 200));
  }
}

// Résultat d'un envoi Messenger : permet au poller de NE PAS marquer "traité" si l'envoi a échoué.
export type SendResult = { ok: true } | { ok: false; authError: boolean; detail: string };

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN!;
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";

// Appel IA AVEC outils (tool use) + FALLBACK Sonnet — comme generateText de @/lib/ai,
// mais qui préserve les tools / stop_reason (generateText ne retourne qu'un string).
// Si le modèle choisi échoue, on réessaie UNE fois sur MODELS.SMART pour ne jamais
// laisser une conversation client tomber.
async function createWithFallback(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model"> & { model: string }
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (e) {
    console.error(`[messenger] modèle "${params.model}" a échoué — fallback Sonnet:`, e);
    if (params.model === MODELS.SMART) throw e;
    return await anthropic.messages.create({ ...params, model: MODELS.SMART });
  }
}

function getSystemPrompt(barbers: { name: string; schedule: DaySched }[], isFirstMessage: boolean): string {
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
- Coupe + Barbe à la lame (rasage lame & serviette chaude): 50$ (60 min)
- Coupe + Barbe Shaver (coupe, barbe & rasage à la tondeuse): 45$ (45 min)
- Service Premium (coupe, rasage, serviette chaude & exfoliant): 75$ (75 min)
- Rasage / Barbe: 25$ (30 min)
- Enfant (12 ans et moins, preuve d'âge): 30$ (30 min)
(Liste TOUJOURS les 6 services au complet.)

COIFFEURS ET HORAIRES (à jour):
${barbersText}
Fermé dimanche et lundi.

COORDONNÉES: 375 Boul. des Chutes, Québec | (418) 665-5703
RÉSERVATION EN LIGNE: https://ciseaunoirbarbershop.com/booking

INFOS UTILES:
- Cartes-cadeaux disponibles (sur le site: https://ciseaunoirbarbershop.com/cartes-cadeaux).
- On parle français et anglais. Fermé dimanche et lundi.

CE QUE TU PEUX FAIRE (la totale):
- Répondre à TOUTE question (services, prix, durées, horaires, coiffeurs, adresse, téléphone, cartes-cadeaux...).
- check_availability: vérifier les vraies dispos.
- book_appointment: réserver.
- find_appointments: retrouver les RDV d'un client ("c'est quand mon rdv?").
- reschedule_appointment: déplacer un RDV.
- cancel_appointment: annuler un RDV.

INSTRUCTIONS:
${isFirstMessage ? `0. PREMIER message de la conversation: commence en te présentant UNE SEULE fois — "Bonjour! 😊 Je suis Figaro, l'assistant virtuel de Ciseau Noir — je suis là pour toutes vos demandes!" — puis enchaîne avec sa demande. Ne te re-présente JAMAIS après.
` : ``}1. Réponds à TOUT comme un pro — ton québécois chaleureux, tutoie, réponses COURTES (c'est Messenger). Quand tu offres des CHOIX (services, coiffeurs, dates, créneaux), présente-les en LISTE NUMÉROTÉE (1, 2, 3...) et invite le client à répondre juste avec le NUMÉRO. Comprends aussi les réponses par numéro.
   ⚠️ Quand le client répond par un NUMÉRO, relis TA liste et prends l'item EXACT à ce numéro (attention: les heures peuvent avoir des trous, compte bien). RÉPÈTE toujours ton choix pour confirmer (ex: "Parfait, 12h45 ✓"). Avant de réserver, fais un récap exact (service, coiffeur, date, HEURE) — jamais d'erreur sur l'heure.
2. Disponibilités: appelle TOUJOURS check_availability (avec la date ET le service) PUIS propose les HEURES PRÉCISES libres en liste numérotée (ex: "1. 9h00  2. 9h45  3. 10h30"). ❌ Ne donne JAMAIS une PLAGE d'heures (genre "entre 8h30 et 20h30") — une plage c'est juste l'horaire de travail du coiffeur, PAS une disponibilité réelle. C'est TOI qui dis les vraies places libres, jamais le client. N'invente aucune heure.
   Quand tu listes les coiffeurs comme choix, donne juste leur NOM (pas leurs heures d'ouverture).
3. Dès que le client veut un rendez-vous, AVANT TOUT (avant même de montrer les services), demande: "Tu veux prendre ton rendez-vous par notre site ou directement avec moi? Les deux sont très faciles 😊\n👉 https://ciseaunoirbarbershop.com/booking" — puis selon sa réponse:
   • EN LIGNE: donne le lien et laisse-le faire.
   • AVEC TOI: SEULEMENT là, montre les services (liste numérotée), puis le coiffeur, puis la date/heure (via check_availability), puis nom + téléphone + EMAIL (obligatoire) → book_appointment.
4. Annuler / déplacer / retrouver un RDV: demande le téléphone OU l'email du client pour le retrouver, puis l'outil approprié. S'il a plusieurs RDV, demande lequel.
5. Tu peux aussi offrir le lien: "Réserve directement ici 👉 https://ciseaunoirbarbershop.com/booking"
6. Si pas de préférence de date, vérifie les 3 prochains jours ouvrables.
7. Si tu NE connais PAS une réponse (ex: stationnement, paiement), sois honnête, propose d'appeler le (418) 665-5703 ou utilise send_sms_alert. N'invente RIEN.
8. Client frustré ou cas complexe → send_sms_alert à l'équipe.`;
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
    name: "cancel_appointment",
    description: "Annuler un rendez-vous existant. Demande au client son téléphone OU son email pour retrouver le RDV. S'il a plusieurs RDV à venir, demande la date précise.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Numéro de téléphone du client" },
        email: { type: "string", description: "Email du client" },
        date: { type: "string", description: "Date du RDV à annuler YYYY-MM-DD (optionnel)" },
        time: { type: "string", description: "Heure du RDV HH:MM (optionnel)" },
      },
      required: [],
    },
  },
  {
    name: "find_appointments",
    description: "Retrouver les rendez-vous à venir d'un client (quand il demande 'c'est quand mon rdv?'). Demande son téléphone OU son email.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Téléphone du client" },
        email: { type: "string", description: "Email du client" },
      },
      required: [],
    },
  },
  {
    name: "reschedule_appointment",
    description: "Déplacer un rendez-vous existant à une nouvelle date/heure. Demande téléphone OU email pour le retrouver, plus la nouvelle date et heure.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Téléphone du client" },
        email: { type: "string", description: "Email du client" },
        old_date: { type: "string", description: "Date actuelle du RDV YYYY-MM-DD (optionnel)" },
        old_time: { type: "string", description: "Heure actuelle HH:MM (optionnel)" },
        new_date: { type: "string", description: "Nouvelle date souhaitée YYYY-MM-DD" },
        new_time: { type: "string", description: "Nouvelle heure souhaitée HH:MM" },
      },
      required: ["new_date", "new_time"],
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

type Bk = { id: string; client_name: string; service: string; barber: string; date: string; time: string; client_phone: string; client_email: string; end_time?: string };

function torontoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }); // YYYY-MM-DD
}

// Retrouve les RDV à venir (non annulés) d'un client par téléphone OU email.
async function findUpcomingBookings(phone?: string, email?: string): Promise<Bk[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id, client_name, service, barber, date, time, client_phone, client_email, end_time")
    .neq("status", "cancelled").gte("date", torontoToday()).order("date").order("time");
  const digits = (phone || "").replace(/\D/g, "");
  return ((data || []) as Bk[]).filter(r => {
    const pMatch = digits.length >= 7 && (r.client_phone || "").replace(/\D/g, "").includes(digits.slice(-7));
    const eMatch = !!email && (r.client_email || "").toLowerCase() === email.toLowerCase();
    return pMatch || eMatch;
  });
}

// Vérifie qu'un créneau est libre pour un barbier (évite le double-booking lors d'un déplacement).
async function isSlotFree(barber: string, date: string, time: string, durationMin: number, excludeId?: string): Promise<boolean> {
  const { data } = await supabase.from("bookings").select("id, time, end_time, service, barber").eq("date", date).neq("status", "cancelled");
  const start = minutesOf(time), end = start + durationMin;
  return !((data || []) as Bk[]).some(x => {
    if (excludeId && x.id === excludeId) return false;
    if (norm(x.barber || "") !== norm(barber)) return false;
    const bStart = minutesOf(x.time || "0:0");
    const bEnd = x.end_time ? minutesOf(x.end_time) : bStart + serviceDuration(x.service || "");
    return start < bEnd && end > bStart;
  });
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
    // Email OBLIGATOIRE (le prompt l'exige) — on force la règle côté code : pas d'email → on redemande, on ne booke pas.
    if (!email || !email.trim()) {
      return "Il me manque ton adresse email pour confirmer la réservation (elle sert à t'envoyer la confirmation). Tu peux me la donner?";
    }
    // Prix : résolu/validé via resolveService (source de vérité = table services). JAMAIS de prix inventé.
    // Si le service ne correspond à rien → on NE BOOKE PAS, on demande de clarifier.
    const svc = await resolveService(service);
    if (!svc.matched) {
      return `Je ne reconnais pas le service « ${service} ». Peux-tu choisir parmi nos services? Coupe + Lavage (35$), Coupe + Barbe à la lame (50$), Coupe + Barbe Shaver (45$), Service Premium (75$), Rasage / Barbe (25$), Enfant (30$).`;
    }
    const price = svc.price;
    const resolvedService = svc.name;
    // Passe par /api/bookings → déclenche email + SMS + Telegram (la totale), pas juste un insert
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
      const res = await fetch(`${base}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: name, client_phone: phone, client_email: email, service: resolvedService, barber, date, time, price, source: "messenger" }),
      });
      const data = await res.json();
      if (!res.ok) return `Erreur lors de la réservation: ${data.error || ("HTTP " + res.status)}`;
      return `Réservation confirmée! ${name}, ${resolvedService} avec ${barber} le ${date} à ${time}.`;
    } catch (e) {
      return `Erreur lors de la réservation: ${String(e)}`;
    }
  }

  if (toolName === "cancel_appointment") {
    const { phone, email, date, time } = toolInput as Record<string, string>;
    if (!phone && !email) return "J'ai besoin de ton numéro de téléphone ou ton email pour retrouver ton rendez-vous.";
    let matches = await findUpcomingBookings(phone, email);
    if (date) matches = matches.filter(r => r.date === date);
    if (time) matches = matches.filter(r => minutesOf(r.time) === minutesOf(time));
    if (matches.length === 0) return "Je trouve aucun rendez-vous à venir avec ces infos. Vérifie ton numéro/email, ou appelle au (418) 665-5703.";
    if (matches.length > 1) return `Tu as ${matches.length} rendez-vous à venir:\n${matches.map(m => `• ${m.date} à ${m.time} — ${m.service} avec ${m.barber}`).join("\n")}\nLequel veux-tu annuler? Donne-moi la date et l'heure.`;
    const m = matches[0];
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", m.id);
    if (error) return `Erreur à l'annulation: ${error.message}`;
    try { await notifyBookingCancelled({ client_name: m.client_name, service: m.service, barber: m.barber, date: m.date, time: m.time }); } catch { /* notif non bloquante */ }
    return `C'est annulé ✓ — ${m.service} avec ${m.barber} le ${m.date} à ${m.time}. Au plaisir de te revoir!`;
  }

  if (toolName === "find_appointments") {
    const { phone, email } = toolInput as Record<string, string>;
    if (!phone && !email) return "Donne-moi ton téléphone ou ton email pour retrouver tes rendez-vous.";
    const matches = await findUpcomingBookings(phone, email);
    if (matches.length === 0) return "Aucun rendez-vous à venir trouvé avec ces infos.";
    return `Tes rendez-vous à venir:\n${matches.map(m => `• ${m.date} à ${m.time} — ${m.service} avec ${m.barber}`).join("\n")}`;
  }

  if (toolName === "reschedule_appointment") {
    const { phone, email, old_date, old_time, new_date, new_time } = toolInput as Record<string, string>;
    if (!phone && !email) return "J'ai besoin de ton téléphone ou ton email pour retrouver ton rendez-vous.";
    if (!new_date || !new_time) return "Dis-moi la nouvelle date et la nouvelle heure souhaitées.";
    let matches = await findUpcomingBookings(phone, email);
    if (old_date) matches = matches.filter(r => r.date === old_date);
    if (old_time) matches = matches.filter(r => minutesOf(r.time) === minutesOf(old_time));
    if (matches.length === 0) return "Je trouve pas le rendez-vous à déplacer. Vérifie tes infos ou appelle au (418) 665-5703.";
    if (matches.length > 1) return `Tu as plusieurs rendez-vous:\n${matches.map(m => `• ${m.date} à ${m.time} — ${m.service}`).join("\n")}\nLequel veux-tu déplacer? Donne-moi la date et l'heure actuelles.`;
    const m = matches[0];
    const dur = serviceDuration(m.service);
    const free = await isSlotFree(m.barber, new_date, new_time, dur, m.id);
    if (!free) return `Le ${new_date} à ${new_time} est déjà pris avec ${m.barber}. Veux-tu que je vérifie les créneaux libres?`;
    const endMin = minutesOf(new_time) + dur;
    const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    const { error } = await supabase.from("bookings").update({ date: new_date, time: new_time, end_time: newEnd }).eq("id", m.id);
    if (error) return `Erreur lors du déplacement: ${error.message}`;
    try { await notifyBookingRescheduled({ client_name: m.client_name, service: m.service, barber: m.barber, old_date: m.date, old_time: m.time, new_date, new_time }); } catch { /* notif non bloquante */ }
    return `Parfait, c'est déplacé ✓ — ${m.service} avec ${m.barber}, maintenant le ${new_date} à ${new_time}.`;
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

export async function sendMessengerMessage(recipientId: string, text: string): Promise<SendResult> {
  // Check if the reply contains the booking URL
  const bookingUrl = "https://ciseaunoirbarbershop.com/booking";
  const hasBookingLink = text.includes(bookingUrl);

  // Send the text (remove the URL from text if we'll send a button)
  const cleanText = hasBookingLink ? text.replace(bookingUrl, "").replace(/👉\s*$/, "").trim() : text;

  // POST du message texte avec un token donné. Retourne la réponse + le corps (texte).
  const postText = async (token: string) =>
    fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: cleanText },
      }),
    });

  // Token de page auto-réparé (re-dérivé depuis le System User token au besoin).
  let token = await getFacebookToken();
  let sendRes = await postText(token);

  // AUTO-RÉPARATION : si l'envoi échoue à cause d'un token mort, on re-dérive un token frais et on RÉESSAIE une fois.
  if (!sendRes.ok) {
    let err = await sendRes.text().catch(() => "");
    if (isFbAuthError(err)) {
      const fresh = await refreshFacebookToken();
      if (fresh) {
        token = fresh;
        sendRes = await postText(token);
        if (!sendRes.ok) err = await sendRes.text().catch(() => "");
      }
    }
    if (!sendRes.ok) {
      const authError = isFbAuthError(err);
      // Si ça échoue ici (souvent token Facebook expiré), on le verra dans les logs Vercel
      console.error(`[Messenger] Échec envoi FB (HTTP ${sendRes.status})${authError ? " — token expiré/invalide" : ""} →`, err.slice(0, 300));
      if (authError) await alertFbTokenDead();
      // Envoi du message texte échoué → on signale au poller (il fera le fallback + ne marquera pas "traité")
      return { ok: false, authError, detail: `HTTP ${sendRes.status} ${err.slice(0, 200)}` };
    }
  }

  // Send a clickable button for booking
  if (hasBookingLink) {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
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

  // Message texte livré avec succès (le bouton est un bonus non bloquant).
  return { ok: true };
}

export async function processMessageWithClaude(senderId: string, userMessage: string): Promise<string> {
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
  const systemPrompt = getSystemPrompt(barbers, existingMessages.length === 0);

  // Agentic loop — conversation CLIENT: meilleur modèle (SMART) + fallback Sonnet si échec
  let response = await createWithFallback({
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

    response = await createWithFallback({
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

// POST: webhook Messenger — RÉPONSE INSTANTANÉE (live). Facebook pousse le message ici dès
// qu'un client écrit → le bot répond dans la seconde (avant qu'un humain lise).
// Dédup PARTAGÉ avec le cron messenger-poll via last_handled_mid → jamais de double réponse.
// Le cron reste un FILET DE SECOURS (si un webhook est manqué). C'est ça, le "live".
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
        if (!event.message?.text) continue;
        if (event.message?.is_echo) continue; // ignore les messages de la page elle-même

        const mid: string | undefined = event.message?.mid;

        // DÉDUP (partagé avec le cron) : message déjà traité → on saute (anti double-réponse + anti-retry FB).
        const { data: convRow } = await supabase
          .from("messenger_conversations")
          .select("last_handled_mid")
          .eq("sender_id", senderId)
          .maybeSingle();
        if (mid && convRow?.last_handled_mid === mid) continue;

        const userText: string = event.message.text;

        // Met à jour le nom de l'expéditeur (non-critique)
        try {
          const profileToken = await getFacebookToken();
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/${senderId}?fields=first_name,last_name&access_token=${profileToken}`
          );
          const profile = await profileRes.json();
          if (profile.first_name) {
            const senderName = `${profile.first_name} ${profile.last_name || ""}`.trim();
            await supabase
              .from("messenger_conversations")
              .upsert({ sender_id: senderId, sender_name: senderName }, { onConflict: "sender_id" });
          }
        } catch {
          // non-critique
        }

        const reply = await processMessageWithClaude(senderId, userText);
        const sent = await sendMessengerMessage(senderId, reply);

        // Marque "traité" SEULEMENT si l'envoi a réussi (sinon le cron réessaiera) → dédup avec le poll.
        if (sent.ok && mid) {
          await supabase
            .from("messenger_conversations")
            .upsert({ sender_id: senderId, last_handled_mid: mid }, { onConflict: "sender_id" });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Messenger webhook error:", e);
    // 200 quand même → évite que FB re-livre en boucle (le cron est le filet de secours).
    return NextResponse.json({ ok: true });
  }
}
