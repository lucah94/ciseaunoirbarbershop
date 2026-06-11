import { NextRequest, NextResponse } from "next/server";
import { processMessageWithClaude, sendMessengerMessage } from "@/app/api/meta/messenger/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "577401682130596";
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const GRAPH = "https://graph.facebook.com/v19.0";

// Vérificateur automatique des messages Messenger (la page est abonnée via Composio).
// Lit les conversations NON LUES, fait répondre le cerveau Claude, marque comme lu.
// La dédup se fait via unread_count : après réponse + mark_seen, la conv repasse à 0.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN) return NextResponse.json({ error: "FACEBOOK_ACCESS_TOKEN manquant" }, { status: 500 });

  try {
    const convRes = await fetch(`${GRAPH}/${PAGE_ID}/conversations?fields=participants,unread_count&limit=25&access_token=${TOKEN}`);
    const convData = await convRes.json();
    if (!convRes.ok) {
      console.error("[messenger-poll] conversations error:", JSON.stringify(convData.error || convData).slice(0, 300));
      return NextResponse.json({ error: convData.error?.message || "conversations fetch failed" }, { status: 500 });
    }

    let handled = 0;
    const errors: string[] = [];

    for (const conv of (convData.data || [])) {
      if (!conv.unread_count || conv.unread_count < 1) continue;
      const recipient = (conv.participants?.data || []).find((p: { id: string }) => p.id !== PAGE_ID);
      if (!recipient?.id) continue;

      try {
        // Derniers messages (du plus récent au plus ancien)
        const msgRes = await fetch(`${GRAPH}/${conv.id}/messages?fields=id,from,message&limit=8&access_token=${TOKEN}`);
        const msgData = await msgRes.json();
        const lastUserMsg = (msgData.data || []).find((m: { from?: { id: string }; message?: string }) => m.from?.id !== PAGE_ID && m.message);
        if (!lastUserMsg?.message) continue;

        const reply = await processMessageWithClaude(recipient.id, lastUserMsg.message);
        await sendMessengerMessage(recipient.id, reply);

        // Marquer comme lu → la conv repasse à unread_count 0 (évite de répondre 2x)
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

    return NextResponse.json({ ok: true, handled, errors });
  } catch (e) {
    console.error("[messenger-poll] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
