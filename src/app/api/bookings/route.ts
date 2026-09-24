import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendBookingConfirmation, sendBookingNotificationAdmin } from "@/lib/email";
import { sendBookingConfirmationSMS, sendBarberNotificationSMS, sendBarberCancellationSMS, formatPhone } from "@/lib/sms";
import { notifyBookingCancelled, notifyNewBooking, proposeRescheduleNotification } from "@/lib/telegram";
import twilio from "twilio";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin, requireBarber } from "@/lib/auth";
import { serviceDuration } from "@/lib/serviceDuration";
export const dynamic = 'force-dynamic';

const bookingSchema = z.object({
  client_name: z.string().min(1, "Le nom est requis").max(100),
  client_email: z.string().email("Courriel invalide").optional().or(z.literal("")),
  client_phone: z.string().optional().or(z.literal("")),
  service: z.string().min(1, "Le service est requis"),
  barber: z.string().min(1, "Barbière requise").max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)"),
  time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Format d'heure invalide"),
  price: z.number().optional(),
  note: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional().default("confirmed"),
  // "comptoir" = RDV entre a la main dans l'admin (sans rendez-vous, telephone, walk-in).
  // Sans ca, ces RDV etaient comptes comme "Direct / Site" et gonflaient le trafic web.
  source: z.enum(["direct", "google", "facebook", "instagram", "referral", "messenger", "comptoir"]).optional().default("direct"),
});

// Champs PII retirés des réponses publiques en masse (?date= / liste).
// L'occupation des créneaux n'en a pas besoin — utiliser /api/availability pour ça.
type BookingRow = Record<string, unknown>;
function stripPII(row: BookingRow): BookingRow {
  const { client_name: _n, client_phone: _p, client_email: _e, note: _nt, ...safe } = row;
  return safe;
}

export async function GET(req: NextRequest) {
  // GET reste PUBLIC mais filtre les PII pour les appels NON authentifiés :
  //  - ?id= (UUID non-devinable) -> RDV complet, nécessaire à /booking/rdv & /booking/cancel.
  //  - ?date= ou liste en masse, NON authentifié -> PII retirées (anti-fuite ~2000 clients).
  //  - admin/barbier authentifié -> réponse complète inchangée (agenda, dashboards).
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barber = searchParams.get("barber");
    const id = searchParams.get("id");
    const start = searchParams.get("start");

    // Authentifié si jeton admin OU barbier valide (requireX renvoie null quand autorisé).
    const isAuthed = requireAdmin(req) === null || requireBarber(req) === null;

    if (id) {
      const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json(data);
    }

    // Pagination côté serveur — Supabase a une limite hard MAX_ROWS=1000 par défaut
    // On boucle avec .range() pour récupérer TOUTES les rows
    const PAGE_SIZE = 1000;
    const all: unknown[] = [];
    let from = 0;
    while (true) {
      let query = supabase.from("bookings").select("*").order("date", { ascending: true }).order("time", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (date) query = query.eq("date", date);
      if (barber) query = query.eq("barber", barber);
      if (start) query = query.gte("date", start);
      const { data: page, error: pageErr } = await query;
      if (pageErr) return NextResponse.json({ error: pageErr.message }, { status: 500 });
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
      // Garde-fou: éviter boucle infinie
      if (from > 50000) break;
    }
    // Non authentifié -> retirer les PII de chaque objet (le booking public n'en a pas besoin).
    const out = isAuthed ? all : (all as BookingRow[]).map(stripPII);
    return NextResponse.json(out);
  } catch (e) {
    console.error("Bookings GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req, { limit: 10, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const forceOverlapPost = !!(rawBody as Record<string, unknown>).force;

  const result = bookingSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const body = result.data;

  // ── Vérification chevauchement (ignoré si force=true) ───────────
  const [nh, nm] = body.time.split(":").map(Number);
  const newStart = nh * 60 + nm;
  const newEnd = newStart + serviceDuration(body.service);

  const [{ data: existing }, { data: blocks }] = await Promise.all([
    supabase.from("bookings").select("time, service, status, end_time")
      .eq("barber", body.barber).eq("date", body.date).neq("status", "cancelled"),
    supabase.from("barber_blocks").select("start_time, end_time")
      .eq("barber", body.barber.toLowerCase()).eq("date", body.date).not("start_time", "is", null),
  ]);

  if (!forceOverlapPost) {
    for (const b of existing || []) {
      const [bh, bm] = (b.time || "0:0").split(":").map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = b.end_time
        ? (() => { const [eh, em] = b.end_time.split(":").map(Number); return eh * 60 + em; })()
        : bStart + serviceDuration(b.service);
      if (newStart < bEnd && newEnd > bStart) {
        return NextResponse.json({ error: "Ce créneau est déjà occupé — chevauchement détecté." }, { status: 409 });
      }
    }

    for (const bl of blocks || []) {
      if (!bl.start_time || !bl.end_time) continue;
      const [bh, bm] = bl.start_time.split(":").map(Number);
      const [eh, em] = bl.end_time.split(":").map(Number);
      const blStart = bh * 60 + bm;
      const blEnd = eh * 60 + em;
      if (newStart < blEnd && newEnd > blStart) {
        return NextResponse.json({ error: "Ce créneau est bloqué par la barbière." }, { status: 409 });
      }
    }
  }
  // ────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────
  const { source: _source, ...bodyWithoutSource } = body;
  let { data, error } = await supabase.from("bookings").insert([body]).select().single();
  if (error?.message?.includes("source")) {
    ({ data, error } = await supabase.from("bookings").insert([bodyWithoutSource]).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ajouter/mettre à jour le client dans les contacts
  if (body.client_phone || body.client_email) {
    const matchField = body.client_phone ? "phone" : "email";
    const matchValue = body.client_phone || body.client_email;
    const { data: existing } = await supabase.from("clients").select("id").eq(matchField, matchValue).single();
    if (!existing) {
      await supabase.from("clients").insert([{
        name: body.client_name,
        phone: body.client_phone || null,
        email: body.client_email || null,
      }]).then(() => {}, () => {});
    }
  }

  // Track conversion Meta/Google Ads (fire-and-forget, n'attend pas la réponse)
  import("@/lib/conversions").then(m => m.trackBookingConversion({
    id: data.id,
    client_name: data.client_name,
    client_email: data.client_email,
    client_phone: data.client_phone,
    price: data.price || 0,
    service: data.service,
    source: data.source,
    created_at: data.created_at,
  })).catch(() => {});

  try {
    await Promise.all([
      data.client_phone && process.env.TWILIO_ACCOUNT_SID ? sendBookingConfirmationSMS({
        client_name: data.client_name,
        client_phone: data.client_phone,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
        booking_id: data.id,
      }).catch(e => console.error("SMS error:", e)) : Promise.resolve(),
      data.client_email ? sendBookingConfirmation({
        client_name: data.client_name,
        client_email: data.client_email,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
        price: data.price,
        note: data.note,
        booking_id: data.id,
      }) : Promise.resolve(),
      sendBookingNotificationAdmin({
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_email: data.client_email,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
        price: data.price,
        note: data.note,
      }),
      sendBarberNotificationSMS({
        client_name: data.client_name,
        client_phone: data.client_phone,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
      }).catch(e => console.error("Barber SMS error:", e)),
      Promise.resolve(), // Telegram nouvelle résa déjà envoyé par un autre mécanisme — éviter le DOUBLE
    ]);
  } catch (emailErr) {
    console.error("Email error:", emailErr);
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  // PATCH reste accessible pour l'annulation self-service du client (/booking/cancel),
  // MAIS un appel NON authentifié ne peut QUE passer status:"cancelled" — toute autre
  // modification (prix, date, heure, barbier, note, statut completed/no_show) exige admin/barbier.
  // Ferme l'IDOR: sans ça, n'importe qui connaissant l'UUID pouvait changer prix/date d'un RDV.
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    // ── Sécurité IDOR ────────────────────────────────────────────────
    const isAuthed = requireAdmin(req) === null || requireBarber(req) === null;
    if (!isAuthed) {
      const keys = Object.keys(updates).filter((k) => k !== "force");
      const onlyCancel = keys.length === 1 && keys[0] === "status" && updates.status === "cancelled";
      // Modification client self-service : date et/ou heure UNIQUEMENT (même service → prix
      // inchangé, aucune triche de prix/service/statut). end_time recalculé serveur.
      const RESCHEDULE_FIELDS = ["date", "time"];
      const onlyReschedule = keys.length >= 1 && keys.every((k) => RESCHEDULE_FIELDS.includes(k));
      if (!onlyCancel && !onlyReschedule) {
        return NextResponse.json(
          { error: "Non autorisé — seules l'annulation ou la modification de date/heure sont permises sans connexion." },
          { status: 403 }
        );
      }
      if (onlyReschedule) {
        const { data: cur } = await supabase.from("bookings").select("service, date, time").eq("id", id).single();
        const todayMtl = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
        if (cur?.date && cur.date < todayMtl) {
          return NextResponse.json({ error: "Ce rendez-vous est déjà passé." }, { status: 400 });
        }
        if (cur?.service) {
          const t = (updates.time as string) || cur.time;
          const [hh, mm] = String(t).split(":").map(Number);
          const endM = hh * 60 + mm + serviceDuration(cur.service);
          updates.end_time = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
        }
      }
    }

    // Empêche l'annulation d'un RDV déjà PASSÉ (client non connecté). Comparaison par JOUR en
    // heure de Montréal (America/Toronto) — corrige l'ancien bug de fuseau (UTC) qui bloquait
    // à tort les annulations le jour même après ~8h.
    if (!isAuthed && updates.status === "cancelled") {
      const { data: b } = await supabase.from("bookings").select("date").eq("id", id).single();
      const todayMtl = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      if (b?.date && b.date < todayMtl) {
        return NextResponse.json({ error: "Ce rendez-vous est déjà passé." }, { status: 400 });
      }
    }
    // ─────────────────────────────────────────────────────────────────

    // ── Overlap check when time/date/barber changes ──────────────────
    const forceOverlap = !!updates.force;
    if (forceOverlap) delete updates.force;
    if (!forceOverlap && (updates.time || updates.date || updates.barber)) {
      const { data: current } = await supabase.from("bookings").select("*").eq("id", id).single();
      if (current) {
        const checkBarber = (updates.barber || current.barber) as string;
        const checkDate = (updates.date || current.date) as string;
        const checkTime = (updates.time || current.time) as string;
        const checkService = (updates.service || current.service) as string;
        const [nh, nm] = checkTime.split(":").map(Number);
        const newStart = nh * 60 + nm;
        const newEnd = newStart + serviceDuration(checkService);

        const { data: existing } = await supabase.from("bookings")
          .select("id, time, service, end_time")
          .eq("barber", checkBarber).eq("date", checkDate).neq("status", "cancelled").neq("id", id);

        for (const b of existing || []) {
          const [bh, bm] = (b.time || "0:0").split(":").map(Number);
          const bStart = bh * 60 + bm;
          const bEnd = b.end_time
            ? (() => { const [eh, em] = (b.end_time as string).split(":").map(Number); return eh * 60 + em; })()
            : bStart + serviceDuration(b.service);
          if (newStart < bEnd && newEnd > bStart) {
            return NextResponse.json({ error: "Ce créneau est déjà occupé — chevauchement détecté." }, { status: 409 });
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────

    // Valeurs AVANT modif — nécessaire pour savoir si date/heure changent vraiment
    // (déplacement) plutôt qu'une autre modif (prix, note...). Fetché ici, PAS dans le
    // bloc chevauchement plus haut : celui-là est sauté quand force=true.
    let beforeReschedule: { client_name: string; client_phone: string; service: string; barber: string; date: string; time: string } | null = null;
    if (isAuthed && (updates.date || updates.time)) {
      const { data: b } = await supabase.from("bookings")
        .select("client_name, client_phone, service, barber, date, time").eq("id", id).single();
      if (b) beforeReschedule = b;
    }

    const { data, error } = await supabase.from("bookings").update(updates as Record<string, unknown>).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── RDV déplacé par un admin/barbier → demande AVANT d'aviser le client (Telegram OUI/NON) ──
    if (
      beforeReschedule && data && updates.status !== "cancelled" &&
      (beforeReschedule.date !== data.date || beforeReschedule.time !== data.time)
    ) {
      try {
        const { data: row } = await supabase.from("pending_posts").insert({
          kind: "reschedule-notify",
          status: "pending",
          content: JSON.stringify({
            client_phone: beforeReschedule.client_phone,
            service: data.service,
            barber: data.barber,
            new_date: data.date,
            new_time: data.time,
            booking_id: data.id,
          }),
        }).select("id").single();
        if (row) {
          await proposeRescheduleNotification({
            id: row.id, clientName: beforeReschedule.client_name, service: data.service, barber: data.barber,
            oldDate: beforeReschedule.date, oldTime: beforeReschedule.time, newDate: data.date, newTime: data.time,
            hasPhone: !!beforeReschedule.client_phone,
          });
        }
      } catch { /* la modif du RDV a déjà réussi — la notif est secondaire, ne bloque jamais */ }
    }

    // ── Auto-créer un cut quand RDV passe à completed (pour calcul paye live) ──
    if (updates.status === "completed" && data) {
      try {
        // Vérifier qu'on n'a pas déjà un cut pour ce booking (évite doublon)
        const { data: existingCut } = await supabase
          .from("cuts").select("id").eq("booking_id", data.id).maybeSingle();

        if (!existingCut) {
          await supabase.from("cuts").insert([{
            barber: data.barber,
            service_name: data.service,
            price: data.price || 0,
            tip: 0,
            discount_percent: 0,
            date: data.date,
            booking_id: data.id,
          }]);
        }
      } catch (cutErr) {
        console.error("Auto-cut creation error:", cutErr);
      }
    }

    if (updates.status === "cancelled") {
      notifyBookingCancelled({
        client_name: data.client_name,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
      }).catch(() => {});
      // Le groupe Telegram général ne suffit pas — chaque barbier doit être avisé
      // directement pour SES propres clients annulés (demande Melynda, 3 sept 2026).
      sendBarberCancellationSMS({
        client_name: data.client_name,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
      }).catch(() => {});
      try {
        const { data: waitlistEntry } = await supabase
          .from("waitlist")
          .select("*")
          .eq("date", data.date)
          .eq("time", data.time)
          .eq("barber", data.barber)
          .eq("notified", false)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (waitlistEntry) {
          const dateFormatted = new Date(data.date + "T12:00:00").toLocaleDateString("fr-CA", {
            weekday: "long", month: "long", day: "numeric",
          });

          if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER) {
            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
            await twilioClient.messages.create({
              from: process.env.TWILIO_PHONE_NUMBER,
              to: formatPhone(waitlistEntry.client_phone),
              body: `Ciseau Noir ✂️ Bonne nouvelle !\n\nUn créneau s'est libéré :\n${waitlistEntry.service} avec ${waitlistEntry.barber}\n📅 ${dateFormatted} à ${waitlistEntry.time}\n\nRéservez vite : ciseaunoirbarbershop.com/booking`,
            }).catch((e: unknown) => console.error("Waitlist SMS error:", e));
          }

          if (waitlistEntry.client_email) {
            const resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder-resend-key');
            const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";
            await resend.emails.send({
              from: FROM_EMAIL,
              to: waitlistEntry.client_email,
              subject: `Un créneau s'est libéré — ${waitlistEntry.service} le ${dateFormatted}`,
              html: `
                <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
                  <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
                  <h1 style="font-weight: 300; font-size: 28px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Bonne nouvelle !</h1>
                  <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>
                  <p style="color: #999; font-size: 15px; margin-bottom: 32px;">Bonjour ${waitlistEntry.client_name},<br>Un créneau s'est libéré sur votre liste d'attente.</p>
                  <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px;">
                    <p style="color: #C9A84C; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px;">Créneau disponible</p>
                    <p style="color: #F5F5F5; margin-bottom: 8px;">${waitlistEntry.service} avec ${waitlistEntry.barber}</p>
                    <p style="color: #999; font-size: 14px;">${dateFormatted} à ${waitlistEntry.time}</p>
                  </div>
                  <a href="https://ciseaunoirbarbershop.com/booking" style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 32px; text-decoration: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">Réserver maintenant</a>
                  <p style="color: #444; font-size: 12px; margin-top: 32px;">2275 Avenue Royale, Québec</p>
                </div>
              `,
            }).catch((e: unknown) => console.error("Waitlist email error:", e));
          }

          await supabase.from("waitlist").update({ notified: true }).eq("id", waitlistEntry.id);
        }
      } catch (waitlistErr) {
        console.error("Waitlist notification error:", waitlistErr);
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Bookings PATCH error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
