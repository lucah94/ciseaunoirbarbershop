import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Envoie une image (upload direct, multipart) dans le groupe Telegram Luca/Melynda.
 * Sert aux visuels préparés à la main (ex: bannière composée localement) qu'on veut
 * leur montrer sans repasser par un flux de génération complet.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN/TELEGRAM_GROUP_CHAT_ID manquant" }, { status: 500 });
  }

  const incoming = await req.formData();
  const file = incoming.get("photo");
  const caption = (incoming.get("caption") as string) || "";
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "champ 'photo' manquant" }, { status: 400 });
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption);
  form.append("photo", file, "image.png");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    if (!res.ok) {
      return NextResponse.json({ error: `Telegram ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur réseau" }, { status: 500 });
  }
}
