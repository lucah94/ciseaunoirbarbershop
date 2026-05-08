import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN non configuré" }, { status: 500 });

  const { action } = await req.json().catch(() => ({ action: "register" }));

  const webhookUrl = `https://ciseaunoirbarbershop.com/api/telegram/webhook`;

  if (action === "register" || !action) {
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ action: "register", webhookUrl, result: data });
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
  const denied = requireAdmin(req);
  if (denied) return denied;

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
