import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function weekRange(offset = 0, capToToday = false) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  let endDate = sun;
  // Pour comparaison équitable: si offset=-1 (semaine passée), capper à même jour-de-semaine que today
  if (capToToday) {
    const todayDayOfWeek = new Date().getDay() || 7;
    const cappedEnd = new Date(mon);
    cappedEnd.setDate(mon.getDate() + todayDayOfWeek - 1);
    endDate = cappedEnd;
  }
  return { start: mon.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] };
}

function monthRange(offset = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: first.toISOString().split("T")[0], end: last.toISOString().split("T")[0] };
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const thisWeek = weekRange(0); // Pour affichage UI (lun-dim complet)
    const lastWeek = weekRange(-1); // Pour affichage UI (lun-dim complet)
    // Pour comparaison équitable (this week en cours vs same period last week)
    const thisWeekToToday = weekRange(0, true); // lundi → aujourd'hui
    const lastWeekSameDay = weekRange(-1, true); // lundi passé → même jour-de-semaine
    const thisMonth = monthRange(0);
    const lastMonth = monthRange(-1);

    // Parallel queries
    const [
      { data: thisWeekBookings },
      { data: lastWeekBookings },
      { data: thisMonthBookings },
      { data: lastMonthBookings },
      { data: allClients },
      { data: thisWeekCuts },
      { data: lastWeekCuts },
      { data: recentCampaigns },
      { data: waitlistCount },
      twilioBalance,
    ] = await Promise.all([
      supabaseAdmin.from("bookings").select("id, status, source, client_email, barber")
        .gte("date", thisWeekToToday.start).lte("date", thisWeekToToday.end).neq("status", "cancelled"),
      supabaseAdmin.from("bookings").select("id, status, source")
        .gte("date", lastWeekSameDay.start).lte("date", lastWeekSameDay.end).neq("status", "cancelled"),
      supabaseAdmin.from("bookings").select("id, status, source, client_email, barber, price")
        .gte("date", thisMonth.start).lte("date", thisMonth.end).neq("status", "cancelled"),
      supabaseAdmin.from("bookings").select("id, status, client_email")
        .gte("date", lastMonth.start).lte("date", lastMonth.end).neq("status", "cancelled"),
      supabaseAdmin.from("clients").select("id, email", { count: "exact", head: true }),
      supabaseAdmin.from("cuts").select("price, tip, discount_percent")
        .gte("date", thisWeekToToday.start).lte("date", thisWeekToToday.end),
      supabaseAdmin.from("cuts").select("price, tip, discount_percent")
        .gte("date", lastWeekSameDay.start).lte("date", lastWeekSameDay.end),
      supabaseAdmin.from("email_campaigns").select("id, subject, sent_to_count, created_at")
        .order("created_at", { ascending: false }).limit(3),
      supabaseAdmin.from("waitlist").select("id", { count: "exact", head: true }),
      fetchTwilioBalance(),
    ]);

    // Revenue calc
    const calcRevenue = (cuts: typeof thisWeekCuts) =>
      (cuts || []).reduce((sum, c) => sum + c.price * (1 - (c.discount_percent || 0) / 100) + (c.tip || 0), 0);

    const thisWeekRevenue = calcRevenue(thisWeekCuts);
    const lastWeekRevenue = calcRevenue(lastWeekCuts);

    // Growth %
    const bookingGrowth = lastWeekBookings?.length
      ? Math.round(((thisWeekBookings?.length || 0) - lastWeekBookings.length) / lastWeekBookings.length * 100)
      : 0;
    const revenueGrowth = lastWeekRevenue > 0
      ? Math.round((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue * 100)
      : 0;

    // Source breakdown this month
    const sources: Record<string, number> = {};
    for (const b of thisMonthBookings || []) {
      const src = b.source || "direct";
      sources[src] = (sources[src] || 0) + 1;
    }

    // Retention: clients this month who also booked last month
    const thisMonthEmails = new Set((thisMonthBookings || []).map(b => b.client_email).filter(Boolean));
    const lastMonthEmails = new Set((lastMonthBookings || []).map(b => b.client_email).filter(Boolean));
    const returningClients = [...thisMonthEmails].filter(e => lastMonthEmails.has(e)).length;
    const retentionRate = thisMonthEmails.size > 0
      ? Math.round(returningClients / thisMonthEmails.size * 100)
      : 0;

    // Avg revenue per client this month
    const monthRevenue = (thisMonthBookings || []).reduce((s, b) => s + (b.price || 0), 0);
    const avgPerClient = thisMonthEmails.size > 0 ? Math.round(monthRevenue / thisMonthEmails.size) : 0;

    // Barber split this week
    const barberSplit: Record<string, number> = {};
    for (const b of thisWeekBookings || []) {
      barberSplit[b.barber] = (barberSplit[b.barber] || 0) + 1;
    }

    return NextResponse.json({
      thisWeek: {
        bookings: thisWeekBookings?.length || 0,
        revenue: thisWeekRevenue,
        bookingGrowth,
        revenueGrowth,
      },
      month: {
        bookings: thisMonthBookings?.length || 0,
        uniqueClients: thisMonthEmails.size,
        returningClients,
        retentionRate,
        avgPerClient,
        sources,
      },
      totals: {
        clients: allClients?.length ?? 0,
        waitlist: waitlistCount?.length ?? 0,
      },
      barberSplit,
      twilioBalance,
      recentCampaigns: recentCampaigns || [],
    });
  } catch (e) {
    console.error("Stats API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function fetchTwilioBalance(): Promise<{ balance: string; currency: string } | null> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { balance: Number(data.balance).toFixed(2), currency: data.currency || "USD" };
  } catch {
    return null;
  }
}
