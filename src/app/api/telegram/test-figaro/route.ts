import { NextRequest, NextResponse } from "next/server";
import { handleConversation } from "@/app/api/telegram/webhook/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Harnais de test du cerveau de Figaro — calcule sa réponse SANS envoyer sur Telegram
 * ni sauvegarder d'historique (sendReply=false). Gardé par ?secret=FIGARO_TEST_SECRET.
 * Permet de tester l'agent admin hors Telegram (QA).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.FIGARO_TEST_SECRET || secret !== process.env.FIGARO_TEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const msg = searchParams.get("msg");
  if (!msg) return NextResponse.json({ error: "msg requis (?msg=...)" }, { status: 400 });

  // chat de test : aucun historique réel, sendReply=false → rien n'est envoyé ni sauvegardé.
  const TEST_CHAT_ID = -987654321;
  try {
    const reply = await handleConversation(TEST_CHAT_ID, msg, false);
    return NextResponse.json({ message: msg, reply });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
