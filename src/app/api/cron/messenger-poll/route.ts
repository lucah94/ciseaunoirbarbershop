import { NextRequest, NextResponse } from "next/server";
import { processMessageWithClaude, sendMessengerMessage } from "@/app/api/meta/messenger/route";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "577401682130596";
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const GRAPH = "https://graph.facebook.com/v19.0";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Une passe : lit les conversations NON LUES, répond, marque comme lu (dédup via unread_count).
async function pollOnce(handledThisRun: Set<string>): Promise<{ handled: number; errors: string[] }> {
  const errors: string[] = [];
  let handled = 0;

  const convRes = await fetch(`${GRAPH}/${PAGE_ID}/conversations?fields=participants,unread_count&limit=25&access_token=${TOKEN}`);
  const convData = await convRes.json();
  if (!convRes.ok) {
    errors.push(`conversations: ${JSON.stringify(convData.error || convData).slice(0, 200)}`);
    return { handled, errors };
  }

  for (const conv of (convData.data || [])) {
    if (!conv.unread_count || conv.unread_count < 1) continue;
    const recipient = (conv.participants?.data || []).find((p: { id: string }) => p.id !== PAGE_ID);
    if (!recipient?.id) continue;
    try {
      const msgRes = await fetch(`${GRAPH}/${conv.id}/messages?fields=id,from,message&limit=8&access_token=${TOKEN}`);
      const msgData = await msgRes.json();
      const lastUserMsg = (msgData.data || []).find((m: { from?: { id: string }; message?: string; id?: string }) => m.from?.id !== PAGE_ID && m.message);
      if (!lastUserMsg?.message || !lastUserMsg.id) continue;

      // ANTI-DOUBLON 1 — déjà traité dans cette exécution (le loop 5s ne re-répond pas)
      if (handledThisRun.has(lastUserMsg.id)) continue;

      // ANTI-DOUBLON 2 — déjà traité dans une exécution précédente (persistant en DB)
      const { data: row } = await supabase
        .from("messenger_conversations")
        .select("last_handled_mid")
        .eq("sender_id", recipient.id)
        .maybeSingle();
      if (row?.last_handled_mid === lastUserMsg.id) {
        handledThisRun.add(lastUserMsg.id);
        continue;
      }

      // RÉSERVER le message AVANT de répondre → une exécution parallèle verra qu'il est pris et n'y touchera pas
      handledThisRun.add(lastUserMsg.id);
      await supabase.from("messenger_conversations").update({ last_handled_mid: lastUserMsg.id }).eq("sender_id", recipient.id);

      const reply = await processMessageWithClaude(recipient.id, lastUserMsg.message);
      await sendMessengerMessage(recipient.id, reply);

      await fetch(`${GRAPH}/${PAGE_ID}/messages?access_token=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipient.id }, sender_action: "mark_seen" }),
      });
      handled++;
    } catch (e) {
      errors.push(`${recipient.id}: ${String(e).slice(0, 120)}`);
    }
  }
  return { handled, errors };
}

// Cron chaque minute. On boucle ~50s en vérifiant aux 5s → réponse client en ~5 secondes.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN) return NextResponse.json({ error: "FACEBOOK_ACCESS_TOKEN manquant" }, { status: 500 });

  const deadline = Date.now() + 50000;
  let total = 0;
  const allErrors: string[] = [];
  const handledThisRun = new Set<string>(); // anti-doublon partagé entre les passages de 5s
  for (;;) {
    const { handled, errors } = await pollOnce(handledThisRun);
    total += handled;
    allErrors.push(...errors);
    if (Date.now() + 5500 >= deadline) break;
    await sleep(5000);
  }
  return NextResponse.json({ ok: true, handled: total, errors: allErrors.slice(0, 10) });
}
