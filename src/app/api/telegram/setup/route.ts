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
