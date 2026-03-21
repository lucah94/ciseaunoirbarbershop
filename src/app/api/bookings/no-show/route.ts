import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendNoShowAdminNotification } from "@/lib/email";
import { sendNoShowSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    // Fetch the booking first
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Seules les réservations confirmées peuvent être marquées no-show" },
        { status: 400 }
      );
    }

    // Update status to no_show
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "no_show" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send SMS to client (if phone available and Twilio configured)
    if (booking.client_phone && process.env.TWILIO_ACCOUNT_SID) {
      await sendNoShowSMS({
        client_name: booking.client_name,
        client_phone: booking.client_phone,
      }).catch(e => console.error("No-show SMS error:", e));
    }

    // Send email notification to admin
    await sendNoShowAdminNotification({
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      client_email: booking.client_email,
      service: booking.service,
      barber: booking.barber,
      date: booking.date,
      time: booking.time,
    }).catch(e => console.error("No-show admin email error:", e));

    console.log(`No-show logged: ${booking.client_name} — ${booking.date} ${booking.time} — ${booking.barber}`);

    return NextResponse.json(data);
  } catch (e) {
    console.error("No-show API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
