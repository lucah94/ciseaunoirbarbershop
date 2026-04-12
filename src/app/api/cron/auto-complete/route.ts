import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendReviewRequestEmail, sendFirstVisitPromoEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function generatePromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BIENVENUE-";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const now = new Date();

    // ── 1. Auto-complete: confirmed bookings where date+time is 1+ hour ago ──
    const { data: confirmedBookings, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .lte("date", now.toISOString().split("T")[0]); // only past or today

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter: appointment start must be at least 1 hour in the past
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const pastBookings = (confirmedBookings || []).filter((b) => {
      if (!b.date || !b.time) return false;
      const appointmentStart = new Date(`${b.date}T${b.time}:00`);
      if (isNaN(appointmentStart.getTime())) return false;
      return appointmentStart <= oneHourAgo;
    });

    let completedCount = 0;
    let reviewsSent = 0;
    let firstVisitPromosSent = 0;

    for (const booking of pastBookings) {
      // Mark as completed
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id);

      if (updateError) {
        console.error(`Auto-complete error for ${booking.id}:`, updateError);
        continue;
      }
      completedCount++;

      // Send review request only if appointment ended 2+ hours ago
      const appointmentStart = new Date(`${booking.date}T${booking.time}:00`);
      if (appointmentStart <= twoHoursAgo && booking.client_email) {
        try {
          await sendReviewRequestEmail({
            client_name: booking.client_name,
            client_email: booking.client_email,
            barber: booking.barber,
            service: booking.service,
          });
          reviewsSent++;
        } catch (e) {
          console.error(`Review email error for ${booking.id}:`, e);
        }

        // ── First visit promo: check if this is the client's first completed booking ──
        try {
          const { data: previousBookings } = await supabase
            .from("bookings")
            .select("id")
            .eq("client_email", booking.client_email)
            .eq("status", "completed")
            .neq("id", booking.id)
            .limit(1);

          if (!previousBookings || previousBookings.length === 0) {
            // This is their first completed booking — send promo!
            const promoCode = generatePromoCode();
            await sendFirstVisitPromoEmail({
              client_name: booking.client_name,
              client_email: booking.client_email,
              barber: booking.barber,
              promo_code: promoCode,
            });
            firstVisitPromosSent++;
          }
        } catch (e) {
          console.error(`First visit promo error for ${booking.id}:`, e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      completed: completedCount,
      reviews_sent: reviewsSent,
      first_visit_promos_sent: firstVisitPromosSent,
      total_processed: pastBookings.length,
    });
  } catch (e) {
    console.error("auto-complete cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
