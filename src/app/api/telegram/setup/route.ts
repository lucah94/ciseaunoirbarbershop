import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

const TELEGRAM_API = "https://api.telegram.org/bot";

function checkSetupAuth(req: NextRequest): boolean {
  // Accept admin cookie OR CRON_SECRET as Bearer/query param
  const adminCheck = requireAdmin(req);
  if (!adminCheck) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
    const queryKey = req.nextUrl.searchParams.get("key");
    if (bearer === cronSecret || queryKey === cronSecret) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!checkSetupAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN non configuré" }, { status: 500 });

  const { action } = await req.json().catch(() => ({ action: "register" }));

  const webhookUrl = `https://ciseaunoirbarbershop.com/api/telegram/webhook`;

  if (action === "register" || !action) {
    // SÉCURITÉ : on enregistre le secret_token. Telegram le renverra dans l'en-tête
    // X-Telegram-Bot-Api-Secret-Token à chaque appel webhook ; la route le vérifie
    // en temps constant (fail closed si TELEGRAM_WEBHOOK_SECRET n'est pas défini).
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({
        error: "TELEGRAM_WEBHOOK_SECRET non configuré — refus d'enregistrer un webhook non sécurisé.",
        hint: "Définis TELEGRAM_WEBHOOK_SECRET (32+ chars [A-Za-z0-9_-]) en variable d'environnement, puis réessaie.",
      }, { status: 400 });
    }
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ action: "register", webhookUrl, secret_token: "configuré ✓", result: data });
  }

  if (action === "status") {
    const res = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ action: "status", result: data });
  }

  if (action === "delete") {
    const res = await fetch(`${TELEGRAM_API}${token}/deleteWebhook`, { method: "POST" });
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ action: "delete", result: data });
  }

  return NextResponse.json({ error: "action invalide (register|status|delete)" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!checkSetupAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN non configuré" }, { status: 500 });

  const [webhookRes, meRes] = await Promise.all([
    fetch(`${TELEGRAM_API}${token}/getWebhookInfo`),
    fetch(`${TELEGRAM_API}${token}/getMe`),
  ]);

  const webhook = await webhookRes.json() as Record<string, unknown>;
  const me = await meRes.json() as Record<string, unknown>;

  return NextResponse.json({ bot: me, webhook });
}
