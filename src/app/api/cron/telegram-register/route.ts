import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const API = "https://api.telegram.org/bot";
const WEBHOOK_URL = "https://ciseaunoirbarbershop.com/api/telegram/webhook";

/**
 * Cron auto-réparant : garde le webhook Telegram de Figaro enregistré AVEC son secret_token.
 * Auth via CRON_SECRET (Bearer injecté par Vercel Cron) — aucun secret manipulé ailleurs.
 * Ne ré-enregistre QUE si nécessaire (URL différente ou updates en attente non livrés, signe
 * que Telegram n'a pas le bon secret) → idempotent, ne spamme pas setWebhook.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN/SECRET manquant" }, { status: 500 });
  }

  const info = await fetch(`${API}${token}/getWebhookInfo`)
    .then((r) => r.json())
    .catch(() => null);
  const cur = info?.result as { url?: string; pending_update_count?: number } | undefined;

  const needsRegister =
    !cur || cur.url !== WEBHOOK_URL || (cur.pending_update_count ?? 0) > 0;

  if (!needsRegister) {
    return NextResponse.json({ ok: true, action: "noop", url: cur?.url });
  }

  const result = await fetch(`${API}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    }),
  })
    .then((r) => r.json())
    .catch((e) => ({ error: String(e) }));

  return NextResponse.json({ ok: true, action: "registered", result });
}
