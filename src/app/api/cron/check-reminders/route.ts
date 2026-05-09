import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendWithButtons(chatId: number, text: string, reminderId: string): Promise<void> {
  await fetch(`${TELEGRAM_API}${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Fait", callback_data: `done_REMIND_${reminderId}` },
          { text: "⏰ +30min", callback_data: `snooze30_REMIND_${reminderId}` },
          { text: "❌ Annuler", callback_data: `cancel_REMIND_${reminderId}` },
        ]],
      },
    }),
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Vérifie le secret pour les appels manuels
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && req.nextUrl.searchParams.get("key") !== cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Reminders dus : remind_at <= now ET (snoozed_until is null OU snoozed_until <= now)
  const { data: due, error } = await supabaseAdmin
    .from("reminders")
    .select("*")
    .eq("done", false)
    .lte("remind_at", now)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const reminder of due) {
    try {
      await sendWithButtons(
        reminder.chat_id as number,
        `⏰ <b>Rappel</b>\n\n${reminder.message as string}`,
        reminder.id as string
      );
      // Mark as done (boutons vont update si snooze)
      await supabaseAdmin.from("reminders").update({ done: true }).eq("id", reminder.id);
      sent++;
    } catch {
      // Continue avec les autres
    }
  }

  return NextResponse.json({ sent });
}
