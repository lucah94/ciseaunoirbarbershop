import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("date", today)
      .neq("status", "cancelled")
      .order("time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = bookings || [];

    const melyndaBookings = all.filter((b) =>
      b.barber?.toLowerCase().includes("melynda")
    );
    const diodisBookings = all.filter((b) =>
      b.barber?.toLowerCase().includes("diodis")
    );

    const totalRevenue = all.reduce((sum, b) => sum + (b.price || 0), 0);

    const formatLines = (bks: typeof all): string => {
      if (bks.length === 0) return "  <i>Aucun RDV</i>";
      return bks
        .map((b) => `  ${b.time} — ${b.client_name} | ${b.service}`)
        .join("\n");
    };

    const message =
      `☀️ <b>Bonjour Melynda — Planning du jour</b>\n\n` +
      `<b>Melynda (${melyndaBookings.length} RDV)</b>\n` +
      `${formatLines(melyndaBookings)}\n\n` +
      `<b>Diodis (${diodisBookings.length} RDV)</b>\n` +
      `${formatLines(diodisBookings)}\n\n` +
      `💰 Revenus estimés: ${totalRevenue}$`;

    await notifySystemAlert(message);

    return NextResponse.json({
      ok: true,
      date: today,
      total: all.length,
      melynda: melyndaBookings.length,
      diodis: diodisBookings.length,
      revenue: totalRevenue,
    });
  } catch (e) {
    console.error("morning-briefing cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
