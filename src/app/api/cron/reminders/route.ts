import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendConfirmationReminderEmail, sendReminderEmail, sendRebookingEmail, sendReengagementEmail } from "@/lib/email";
import { sendConfirmationReminderSMS, sendReminderSMS } from "@/lib/sms";
import twilio from "twilio";
import { formatPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // ── 1. Rappels J-1 ──────────────────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", tomorrowStr)
      .eq("status", "confirmed");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let remindersSent = 0;
    for (const booking of bookings || []) {
      if (!booking.client_phone && !booking.client_email) continue;
      try {
        const rdvUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/booking/rdv/${booking.id}`;
        // SMS en priorité, email seulement si pas de téléphone
        if (booking.client_phone && process.env.TWILIO_ACCOUNT_SID) {
          await sendReminderSMS({
            client_name: booking.client_name,
            client_phone: booking.client_phone,
            service: booking.service,
            barber: booking.barber,
            date: booking.date,
            time: booking.time,
            booking_id: booking.id,
            rdv_url: rdvUrl,
          });
        } else if (booking.client_email) {
          await sendReminderEmail({
            client_name: booking.client_name,
            client_email: booking.client_email,
            service: booking.service,
            barber: booking.barber,
            date: booking.date,
            time: booking.time,
            price: booking.price,
            booking_id: booking.id,
          });
        }
        remindersSent++;
      } catch (e) {
        console.error(`Reminder error for ${booking.id}:`, e);
      }
    }

    // ── 2. SMS rebooking 3 semaines après un rdv complété ────────────
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const threeWeeksAgoStr = threeWeeksAgo.toISOString().split("T")[0];

    const { data: completedBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", threeWeeksAgoStr)
      .eq("status", "completed");

    let rebookingSent = 0;
    if (process.env.TWILIO_ACCOUNT_SID && completedBookings?.length) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      for (const booking of completedBookings) {
        // Envoyer SMS de rebooking
        if (booking.client_phone) {
          const barberParam = booking.barber?.toLowerCase().includes("melynda") ? "melynda" : "diodis";
          try {
            await twilioClient.messages.create({
              from: process.env.TWILIO_PHONE_NUMBER,
              to: formatPhone(booking.client_phone),
              body: `Ciseau Noir ✂️ Bonjour ${booking.client_name} !\n\nÇa fait 3 semaines depuis votre dernière coupe avec ${booking.barber}. Prêt pour un rafraîchissement ?\n\nRéservez en ligne : ${process.env.NEXT_PUBLIC_SITE_URL}/booking?barber=${barberParam}`,
            });
            rebookingSent++;
          } catch (e) {
            console.error(`Rebooking SMS error for ${booking.id}:`, e);
          }
        }
        // Envoyer email de rebooking aussi
        if (booking.client_email) {
          await sendRebookingEmail({
            client_name: booking.client_name,
            client_email: booking.client_email,
            barber: booking.barber,
          }).catch(e => console.error("Rebooking email error:", e));
        }
      }
    }

    // ── 3. Re-engagement 30 / 60 / 90 jours ─────────────────────────
    const reengagementMilestones = [
      { days: 30, sms: (name: string, url: string) => `Ça fait un mois depuis votre dernière visite chez Ciseau Noir! Votre coiffure a besoin d'un rafraîchissement? Réservez maintenant: ${url}` },
      { days: 60, sms: (name: string, url: string) => `On ne vous a pas vu depuis 2 mois chez Ciseau Noir. Vous nous manquez! Profitez de nos services: ${url}` },
      { days: 90, sms: (name: string, url: string) => `Ça fait 3 mois! Revenez nous voir chez Ciseau Noir. Réservez votre place: ${url}` },
    ] as const;

    let reengagementSent = 0;
    const twilioReady = !!process.env.TWILIO_ACCOUNT_SID;
    const twilioClientReeng = twilioReady
      ? twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
      : null;

    for (const milestone of reengagementMilestones) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - milestone.days);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Find bookings completed exactly N days ago
      const { data: oldBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("date", targetDateStr)
        .eq("status", "completed");

      if (!oldBookings?.length) continue;

      for (const booking of oldBookings) {
        // Skip if no email (can't dedupe without it)
        if (!booking.client_email) continue;

        // Check client hasn't booked anything after that date
        const { data: newerBookings } = await supabase
          .from("bookings")
          .select("id")
          .eq("client_email", booking.client_email)
          .gt("date", targetDateStr)
          .in("status", ["confirmed", "completed"])
          .limit(1);

        if (newerBookings && newerBookings.length > 0) continue;

        const barberParam = booking.barber?.toLowerCase().includes("melynda") ? "melynda" : "diodis";
        const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/booking?barber=${barberParam}`;

        // Send SMS
        if (booking.client_phone && twilioClientReeng) {
          try {
            await twilioClientReeng.messages.create({
              from: process.env.TWILIO_PHONE_NUMBER,
              to: formatPhone(booking.client_phone),
              body: milestone.sms(booking.client_name, bookingUrl),
            });
            reengagementSent++;
          } catch (e) {
            console.error(`Re-engagement SMS (${milestone.days}d) error for ${booking.id}:`, e);
          }
        }

        // Send email
        if (booking.client_email) {
          await sendReengagementEmail({
            client_name: booking.client_name,
            client_email: booking.client_email,
            barber: booking.barber,
            variant: milestone.days as 30 | 60 | 90,
          }).catch(e => console.error(`Re-engagement email (${milestone.days}d) error:`, e));
        }
      }
    }

    return NextResponse.json({
      ok: true,
      reminders_sent: remindersSent,
      rebooking_sent: rebookingSent,
      reengagement_sent: reengagementSent,
      total_reminders: bookings?.length || 0,
      total_rebooking: completedBookings?.length || 0,
    });
  } catch (e) {
    console.error("reminders cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
