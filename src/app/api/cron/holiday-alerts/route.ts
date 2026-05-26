import { NextRequest, NextResponse } from "next/server";
import { getUpcomingHolidays } from "@/lib/holidays-qc";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TELEGRAM_API = "https://api.telegram.org/bot";
const ALERT_THRESHOLDS = [14, 7, 3, 1];

async function sendTelegram(text: string, keyboard?: object): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: keyboard } : {}),
    }),
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const forceRun = req.nextUrl.searchParams.get("force") === "1";

  if (!forceRun && cronSecret && auth !== `Bearer ${cronSecret}` && req.nextUrl.searchParams.get("key") !== cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const upcoming = getUpcomingHolidays(15);
  const alerts: string[] = [];

  for (const holiday of upcoming) {
    const holidayDate = new Date(holiday.date + "T12:00:00");
    const diffDays = Math.round((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!ALERT_THRESHOLDS.includes(diffDays)) continue;

    // Vérifie si on a déjà alerté aujourd'hui pour ce jour férié
    const alertKey = `holiday_alert_${holiday.date}_J${diffDays}`;
    const { data: existing } = await supabaseAdmin
      .from("barber_blocks")
      .select("id")
      .eq("reason", alertKey)
      .eq("date", todayStr)
      .limit(1);

    if (existing?.length && !forceRun) continue;

    const daysLabel = diffDays === 1 ? "demain" : `dans ${diffDays} jours`;
    const msg = `${holiday.emoji} <b>J-${diffDays} — ${holiday.name}</b>\n\n${holiday.name} ${daysLabel} (${holiday.date}).\n\nVoulez-vous bloquer le calendrier ?`;

    await sendTelegram(msg, {
      inline_keyboard: [[
        { text: "🔒 Bloquer Melynda", callback_data: `block_all_${holiday.date}` },
        { text: "✅ Déjà géré", callback_data: `holiday_ok_${holiday.date}` },
      ]],
    });

    // Marque comme envoyé (on réutilise barber_blocks avec une raison spéciale)
    await supabaseAdmin.from("barber_blocks").insert({
      barber: "_system",
      date: todayStr,
      reason: alertKey,
    }).then(() => {}); // Ignore les erreurs de doublon

    alerts.push(`J-${diffDays}: ${holiday.name}`);
  }

  return NextResponse.json({ date: todayStr, alerts_sent: alerts });
}
