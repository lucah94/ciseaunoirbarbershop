import { NextRequest, NextResponse } from "next/server";
import { refreshFacebookToken, checkFacebookTokenHealth } from "@/lib/fbToken";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { runCron } from "@/lib/cron-log";
import { notifySystemAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Garde le token Messenger en vie ET surveille sa santé. Tourne aux 6h.
 *
 * 1. Re-dérive proactivement le token de PAGE depuis le token System User permanent
 *    et le met en cache (DB) — même si Facebook invalide l'ancien, il se refait tout seul.
 * 2. VÉRIFIE ensuite en ligne (appel Graph /me) que le token fonctionne vraiment.
 * 3. Si l'ancre (token System User) est absente/morte → l'auto-réparation est impossible :
 *    on prévient Melynda UNE fois (anti-spam 12h) avec un message clair et actionnable,
 *    au lieu de laisser le bot muet sans que personne ne le sache.
 */

// Anti-spam : on ne prévient Melynda qu'une fois par 12h pour ce problème.
const ALERT_THROTTLE_MS = 12 * 60 * 60 * 1000;
const ALERT_TYPE = "fb-token-refresh-alert";

async function alertOwnerOnce(message: string): Promise<void> {
  try {
    const { data: recent } = await supabase
      .from("sms_log")
      .select("sent_at")
      .eq("message_type", ALERT_TYPE)
      .gte("sent_at", new Date(Date.now() - ALERT_THROTTLE_MS).toISOString())
      .limit(1);
    if (recent && recent.length > 0) return; // déjà prévenue récemment → pas de spam
    await notifySystemAlert(message);
    await supabase
      .from("sms_log")
      .insert([{ phone: "fb-token", message_type: ALERT_TYPE, message_preview: message.slice(0, 200) }]);
  } catch {
    /* alerte non bloquante */
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return await runCron("fb-token-refresh", async () => {
    const token = await refreshFacebookToken();

    // Health-check réel : le token de page répond-il à Graph ?
    const { ok, hasAnchor } = await checkFacebookTokenHealth();

    if (ok && token) {
      return NextResponse.json({ ok: true, refreshed: true, healthy: true });
    }

    // Le bot Messenger ne peut PAS répondre aux clients. On prévient Melynda clairement.
    if (!hasAnchor) {
      // Cause la plus fréquente du "marche jamais" : le token n'a jamais été (correctement) branché.
      await alertOwnerOnce(
        "🔴 Le bot Messenger de Ciseau Noir ne peut pas répondre aux clients : le jeton Facebook n'est pas connecté (ou expiré). " +
        "Il faut générer un nouveau jeton avec ton compte Facebook, puis me le donner pour que je le branche. " +
        "Écris-moi \"jeton facebook\" et je te donne les étapes exactes. En attendant, réponds aux messages Messenger à la main. 🙏"
      );
    } else {
      // L'ancre existe mais le token dérivé ne passe pas → probable retrait du bot dans Business Manager.
      await alertOwnerOnce(
        "🟠 Le bot Messenger a un souci de connexion Facebook : le jeton existe mais Facebook le refuse. " +
        "Le bot a peut-être été retiré des accès dans Facebook Business. À vérifier — écris-moi \"jeton facebook\" pour les étapes."
      );
    }
    return NextResponse.json({ ok: false, refreshed: !!token, healthy: false, hasAnchor });
  });
}
