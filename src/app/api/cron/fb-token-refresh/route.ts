import { NextRequest, NextResponse } from "next/server";
import { refreshFacebookToken } from "@/lib/fbToken";
import { runCron } from "@/lib/cron-log";
import { notifySystemAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Re-dérive proactivement le token de PAGE depuis le token System User permanent
 * et le met en cache (DB). Tourne aux 6h. Garantit que le bot a toujours un token
 * de page frais — même si Facebook invalide l'ancien, il se re-fabrique tout seul.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return await runCron("fb-token-refresh", async () => {
    const token = await refreshFacebookToken();
    if (!token) {
      await notifySystemAlert(
        "⚠️ Auto-refresh token FB: impossible de dériver le token de page. Vérifier FACEBOOK_SYSTEM_USER_TOKEN (token système expiré/retiré?)."
      );
      return NextResponse.json({ ok: false, refreshed: false });
    }
    return NextResponse.json({ ok: true, refreshed: true, length: token.length });
  });
}
