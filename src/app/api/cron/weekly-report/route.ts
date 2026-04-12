import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWeeklyReportEmail } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    // Query bookings for the past 7 days
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);

    const allBookings = bookings || [];

    const totalBookings = allBookings.filter(
      (b) => b.status === "confirmed" || b.status === "completed"
    ).length;

    const cancellations = allBookings.filter(
      (b) => b.status === "cancelled"
    ).length;

    const noShows = allBookings.filter(
      (b) => b.status === "no_show" || b.no_show === true
    ).length;

    const activeBookings = allBookings.filter(
      (b) => b.status === "confirmed" || b.status === "completed"
    );
    const bookingsMelynda = activeBookings.filter(
      (b) => b.barber?.toLowerCase().includes("melynda")
    ).length;
    const bookingsDiodis = activeBookings.filter(
      (b) => b.barber?.toLowerCase().includes("diodis")
    ).length;

    // Revenue from cuts table (more accurate with tips/discounts)
    const { data: cuts } = await supabaseAdmin
      .from("cuts")
      .select("price, tip, discount_percent")
      .gte("date", startDate)
      .lte("date", endDate);

    let totalRevenue = 0;
    if (cuts && cuts.length > 0) {
      totalRevenue = cuts.reduce(
        (sum, c) => sum + c.price * (1 - (c.discount_percent || 0) / 100) + (c.tip || 0),
        0
      );
    } else {
      totalRevenue = allBookings
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + (b.price || 0), 0);
    }

    // Waitlist signups
    const { count: waitlistCount } = await supabaseAdmin
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());

    const newWaitlist = waitlistCount || 0;

    // Send the email — wrapped to not crash the cron
    await sendWeeklyReportEmail({
      startDate,
      endDate,
      totalBookings,
      totalRevenue,
      cancellations,
      noShows,
      newWaitlist,
      bookingsMelynda,
      bookingsDiodis,
    });

    return NextResponse.json({
      ok: true,
      period: { startDate, endDate },
      stats: {
        totalBookings,
        totalRevenue,
        cancellations,
        noShows,
        newWaitlist,
        bookingsMelynda,
        bookingsDiodis,
      },
    });
  } catch (e) {
    console.error("weekly-report cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
