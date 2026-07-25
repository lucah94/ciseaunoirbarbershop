import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const API = "https://api.telegram.org/bot";
const WEBHOOK_URL = "https://ciseaunoirbarbershop.com/api/telegram/webhook";

/**
 * S'assure (idempotent) que le webhook Telegram de Figaro est enregistré AVEC son secret_token.
 * SÛR même en public : ne prend AUCUN input, ne fait qu'imposer NOTRE URL + NOTRE secret (lus
 * côté serveur, jamais exposés). Sert aussi de diagnostic (retourne l'état getWebhookInfo).
 * Le fix sécurité (webhook fail-closed) exige cet enregistrement ; ceci le garantit sans
 * manipuler de secret à la main.
 */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN manquant" }, { status: 500 });
  if (!secret) return NextResponse.json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET manquant" }, { status: 500 });

  const info = await fetch(`${API}${token}/getWebhookInfo`).then((r) => r.json()).catch(() => null);
  const cur = info?.result as
    | { url?: string; pending_update_count?: number; last_error_message?: string }
    | undefined;

  const before = {
    url: cur?.url ?? null,
    pending: cur?.pending_update_count ?? null,
    last_error: cur?.last_error_message ?? null,
  };

  // Ré-enregistre si : URL absente/différente, ou des updates s'accumulent (Telegram n'arrive
  // pas à livrer = secret non accepté), ou la dernière erreur mentionne un rejet.
  const needs =
    !cur ||
    cur.url !== WEBHOOK_URL ||
    (cur.pending_update_count ?? 0) > 0 ||
    /401|403|secret|unauthor/i.test(cur.last_error_message || "");

  if (!needs) {
    return NextResponse.json({ ok: true, action: "noop", before });
  }

  const result = await fetch(`${API}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  })
    .then((r) => r.json())
    .catch((e) => ({ error: String(e) }));

  return NextResponse.json({ ok: true, action: "registered", before, result });
}
