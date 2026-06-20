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
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeekStr = montrealDateStr(lastWeekDate);

    const { data: todayBookings, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("date", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: lastWeekBookings } = await supabaseAdmin
      .from("bookings")
      .select("price, status")
      .eq("date", lastWeekStr);

    const all = todayBookings || [];

    const completed = all.filter((b) => b.status === "completed").length;
    const confirmed = all.filter((b) => b.status === "confirmed").length;
    const cancelled = all.filter((b) => b.status === "cancelled").length;
    const noShow = all.filter(
      (b) => b.status === "no_show" || b.no_show === true
    ).length;

    const revenue = all
      .filter((b) => b.status === "completed" || b.status === "confirmed")
      .reduce((sum, b) => sum + (b.price || 0), 0);

    const lastWeekRevenue = (lastWeekBookings || [])
      .filter((b) => b.status === "completed" || b.status === "confirmed")
      .reduce((sum, b) => sum + (b.price || 0), 0);

    const revenueDiff = revenue - lastWeekRevenue;
    const revenueArrow = revenueDiff >= 0 ? "▲" : "▼";

    // Répartition par barbier — DYNAMIQUE (inclut Stéphanie et tout autre barbier, plus de "Melynda" codé en dur)
    const perBarber = new Map<string, number>();
    for (const b of all) {
      if (b.status === "cancelled") continue;
      const name = (b.barber || "").trim();
      if (!name) continue;
      perBarber.set(name, (perBarber.get(name) || 0) + 1);
    }
    const barberLines = [...perBarber.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `👤 ${name}: ${count} RDV`)
      .join("\n");

    const dateLabel = new Date(today + "T12:00:00").toLocaleDateString(
      "fr-CA",
      { weekday: "long", day: "numeric", month: "long" }
    );

    const message =
      `🌙 <b>Résumé — ${dateLabel}</b>\n\n` +
      `✅ Complétés: ${completed} | ⏳ Confirmés: ${confirmed} | ❌ No-show: ${noShow}\n` +
      `💰 Revenus: ${revenue}$ (${revenueArrow} vs semaine passée: ${Math.abs(revenueDiff)}$)\n\n` +
      `${barberLines || "Aucun RDV aujourd'hui"}`;

    await notifySystemAlert(message);

    return NextResponse.json({
      ok: true,
      date: today,
      completed,
      confirmed,
      cancelled,
      no_show: noShow,
      revenue,
      revenue_last_week: lastWeekRevenue,
      byBarber: Object.fromEntries(perBarber),
    });
  } catch (e) {
    console.error("daily-summary cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
