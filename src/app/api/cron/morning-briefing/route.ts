import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";
import { montrealDateStr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const today = montrealDateStr();

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

    const totalRevenue = all.reduce((sum, b) => sum + (b.price || 0), 0);

    // Planning par barbier — DYNAMIQUE (chaque barbier qui a des RDV aujourd'hui)
    const byBarber = new Map<string, typeof all>();
    for (const b of all) {
      const name = (b.barber || "").trim() || "Sans barbier";
      if (!byBarber.has(name)) byBarber.set(name, []);
      byBarber.get(name)!.push(b);
    }

    const formatLines = (bks: typeof all): string => {
      if (bks.length === 0) return "  <i>Aucun RDV</i>";
      return bks
        .map((b) => `  ${b.time} — ${b.client_name} | ${b.service}`)
        .join("\n");
    };

    const barberSections = [...byBarber.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, bks]) => {
        const sorted = [...bks].sort((x, y) => (x.time || "").localeCompare(y.time || ""));
        return `<b>${name} (${bks.length} RDV)</b>\n${formatLines(sorted)}`;
      })
      .join("\n\n");

    const message =
      `☀️ <b>Bonjour Melynda — Planning du jour</b>\n\n` +
      `${barberSections || "<i>Aucun RDV aujourd'hui</i>"}\n\n` +
      `💰 Revenus estimés: ${totalRevenue}$`;

    await notifySystemAlert(message);

    return NextResponse.json({
      ok: true,
      date: today,
      total: all.length,
      barbers: byBarber.size,
      revenue: totalRevenue,
    });
  } catch (e) {
    console.error("morning-briefing cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
