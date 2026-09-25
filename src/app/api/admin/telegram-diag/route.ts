import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API = "https://api.telegram.org/bot";
const WEBHOOK_URL = "https://ciseaunoirbarbershop.com/api/telegram/webhook";

/**
 * État réel du bot Telegram (Figaro) : webhook enregistré, dernière erreur que Telegram
 * a vue en essayant de nous livrer, messages en attente non livrés. Sans secret exposé —
 * juste ce que /getWebhookInfo renvoie.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN manquant dans Vercel" }, { status: 500 });
  }

  const [infoRes, meRes] = await Promise.all([
    fetch(`${API}${token}/getWebhookInfo`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
    fetch(`${API}${token}/getMe`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
  ]);

  const info = infoRes?.result as {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  } | undefined;

  const problemes: string[] = [];
  if (!infoRes?.ok) problemes.push(`getWebhookInfo a échoué : ${JSON.stringify(infoRes).slice(0, 200)}`);
  if (!meRes?.ok) problemes.push(`Le jeton du bot semble invalide (getMe a échoué) — bot peut-être régénéré/révoqué.`);
  if (info && info.url !== WEBHOOK_URL) problemes.push(`Mauvaise URL de webhook enregistrée : "${info.url || "(vide)"}" au lieu de "${WEBHOOK_URL}".`);
  if (info?.pending_update_count && info.pending_update_count > 0) {
    problemes.push(`${info.pending_update_count} message(s) en attente non livrés — Telegram n'arrive pas à nous joindre.`);
  }
  if (info?.last_error_message) {
    const quandMs = (info.last_error_date || 0) * 1000;
    const ilYA = Math.round((Date.now() - quandMs) / 60000);
    problemes.push(`Dernière erreur vue par Telegram (il y a ${ilYA} min) : ${info.last_error_message}`);
  }
  if (!secret) problemes.push("TELEGRAM_WEBHOOK_SECRET manquant — le webhook n'est peut-être pas protégé.");
  if (!chatId) problemes.push("TELEGRAM_GROUP_CHAT_ID manquant — le bot ne sait pas où envoyer les alertes/approbations.");

  return NextResponse.json({
    ok: problemes.length === 0,
    verdict: problemes.length === 0 ? "Tout semble en ordre côté Telegram." : problemes.join(" | "),
    bot: meRes?.result ? { username: meRes.result.username, id: meRes.result.id } : null,
    webhook: info,
    problemes,
  }, { status: problemes.length === 0 ? 200 : 207 });
}
