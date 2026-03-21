import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendBookingConfirmation, sendBookingNotificationAdmin } from "@/lib/email";
import { sendBookingConfirmationSMS, sendBarberNotificationSMS, formatPhone } from "@/lib/sms";
import twilio from "twilio";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const bookingSchema = z.object({
  client_name: z.string().min(1, "Le nom est requis").max(100),
  client_email: z.string().email("Courriel invalide").optional().or(z.literal("")),
  client_phone: z.string().optional().or(z.literal("")),
  service: z.string().min(1, "Le service est requis"),
  barber: z.string().min(1, "Le coiffeur est requis"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Format d'heure invalide (HH:MM)"),
  price: z.number().optional(),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barber = searchParams.get("barber");
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json(data);
    }

    let query = supabase.from("bookings").select("*").order("date", { ascending: true }).order("time", { ascending: true });

    if (date) query = query.eq("date", date);
    if (barber) query = query.eq("barber", barber);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
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

  const result = bookingSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const body = result.data;

  const { data, error } = await supabase.from("bookings").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await Promise.all([
      data.client_phone && process.env.TWILIO_ACCOUNT_SID ? sendBookingConfirmationSMS({
        client_name: data.client_name,
        client_phone: data.client_phone,
        service: data.service,
        barber: data.barber,
        date: data.date,
        time: data.time,
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
    ]);
  } catch (emailErr) {
    console.error("Email error:", emailErr);
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (updates.status === "cancelled") {
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
              body: `Ciseau Noir ✂️ Bonne nouvelle !\n\nUn créneau s'est libéré :\n${waitlistEntry.service} avec ${waitlistEntry.barber}\n📅 ${dateFormatted} à ${waitlistEntry.time}\n\nRéservez vite : ciseunoirbarbershop.com/booking`,
            }).catch((e: unknown) => console.error("Waitlist SMS error:", e));
          }

          if (waitlistEntry.client_email) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseunoirbarbershop.com>";
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
                  <a href="https://ciseunoirbarbershop.com/booking" style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 32px; text-decoration: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">Réserver maintenant</a>
                  <p style="color: #444; font-size: 12px; margin-top: 32px;">375 Boul. des Chutes, Québec</p>
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
