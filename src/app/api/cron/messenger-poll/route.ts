import { NextRequest, NextResponse } from "next/server";
import { processMessageWithClaude, sendMessengerMessage, isFbAuthError, alertFbTokenDead, looksLikeSpam } from "@/app/api/meta/messenger/route";
import { notifyMessengerUnreachable, notifySystemAlert } from "@/lib/telegram";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { runCron } from "@/lib/cron-log";
import { getFacebookToken } from "@/lib/fbToken";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "577401682130596";
const GRAPH = "https://graph.facebook.com/v19.0";

// Une passe : lit les conversations NON LUES, répond, marque comme lu (dédup via unread_count).
async function pollOnce(TOKEN: string, handledThisRun: Set<string>): Promise<{ handled: number; errors: string[] }> {
  const errors: string[] = [];
  let handled = 0;

  const convRes = await fetch(`${GRAPH}/${PAGE_ID}/conversations?fields=participants,unread_count&limit=25&access_token=${TOKEN}`);
  const convData = await convRes.json();
  if (!convRes.ok) {
    // Token FB mort dès l'appel conversations → alerte (anti-spam interne 3h)
    if (isFbAuthError(convData.error || convData)) await alertFbTokenDead();
    errors.push(`conversations: ${JSON.stringify(convData.error || convData).slice(0, 200)}`);
    return { handled, errors };
  }

  for (const conv of (convData.data || [])) {
    if (!conv.unread_count || conv.unread_count < 1) continue;
    const recipient = (conv.participants?.data || []).find((p: { id: string; name?: string }) => p.id !== PAGE_ID);
    if (!recipient?.id) continue;
    const recipientName: string = recipient.name || "Client inconnu";
    try {
      const msgRes = await fetch(`${GRAPH}/${conv.id}/messages?fields=id,from,message&limit=8&access_token=${TOKEN}`);
      const msgData = await msgRes.json();
      const lastUserMsg = (msgData.data || []).find((m: { from?: { id: string }; message?: string; id?: string }) => m.from?.id !== PAGE_ID && m.message);
      if (!lastUserMsg?.message || !lastUserMsg.id) continue;

      // ANTI-DOUBLON 1 — déjà traité dans cette exécution (le loop 5s ne re-répond pas)
      if (handledThisRun.has(lastUserMsg.id)) continue;

      // ANTI-DOUBLON 2 — déjà traité dans une exécution précédente (persistant en DB)
      const { data: row } = await supabase
        .from("messenger_conversations")
        .select("last_handled_mid")
        .eq("sender_id", recipient.id)
        .maybeSingle();
      if (row?.last_handled_mid === lastUserMsg.id) {
        handledThisRun.add(lastUserMsg.id);
        continue;
      }

      // RÉSERVER le message en mémoire AVANT de répondre → évite qu'un autre passage (loop 5s)
      // re-réponde au même message. On NE persiste PAS encore last_handled_mid en DB : on ne le
      // marquera "traité" qu'APRÈS un envoi réussi, sinon un message non livré serait perdu.
      handledThisRun.add(lastUserMsg.id);

      const reply = await processMessageWithClaude(recipient.id, lastUserMsg.message);
      const sent = await sendMessengerMessage(recipient.id, reply);

      if (!sent.ok) {
        // Deux cas distincts :
        //  - authError (token FB mort) → on NE marque PAS "traité" : récupérable, on réessaiera une fois
        //    le token régénéré (et alertFbTokenDead, throttlé, gère l'alerte côté sendMessengerMessage).
        //  - sinon (fenêtre 24h Facebook dépassée = échec PERMANENT) → on marque "traité" pour ne PAS
        //    réessayer/alerter en boucle chaque minute. On alerte UNE seule fois pour qu'un humain reprenne.
        if (!sent.authError) {
          await supabase.from("messenger_conversations").update({ last_handled_mid: lastUserMsg.id }).eq("sender_id", recipient.id);
          if (!looksLikeSpam(String(lastUserMsg.message))) {
            try {
              await notifyMessengerUnreachable({
                senderName: recipientName,
                clientMessage: String(lastUserMsg.message),
                draftReply: reply,
                reason: sent.detail || "fenêtre 24h dépassée ou permission refusée",
              });
            } catch { /* notif non bloquante */ }
            const melyndaPhone = process.env.MELYNDA_PHONE;
            if (melyndaPhone) {
              try {
                await sendSMS(
                  melyndaPhone,
                  `Messenger: ${recipientName} a écrit mais le bot n'a pas pu répondre.\n"${String(lastUserMsg.message).slice(0, 200)}"\nRéponds-lui toi-même dans Messenger si tu veux.`,
                  `messenger_unreachable_${recipient.id}`
                );
              } catch { /* non-bloquant */ }
            }
          }
        }
        errors.push(`${recipient.id}: envoi non livré (${sent.detail})`);
        continue;
      }

      // Envoi réussi → SEULEMENT MAINTENANT on marque le message comme traité (persistant en DB).
      await supabase.from("messenger_conversations").update({ last_handled_mid: lastUserMsg.id }).eq("sender_id", recipient.id);

      await fetch(`${GRAPH}/${PAGE_ID}/messages?access_token=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipient.id }, sender_action: "mark_seen" }),
      });
      handled++;
    } catch (e) {
      errors.push(`${recipient.id}: ${String(e).slice(0, 120)}`);
    }
  }
  return { handled, errors };
}

/**
 * Chien de garde INDÉPENDANT du chemin d'envoi — détecte le bot muet même si un futur
 * bug casse la fois le send ET son propre code d'alerte (2 chemins de code différents
 * qui pourraient tous les deux avoir un bug en même temps, c'est peu probable ; ici c'est
 * une requête DB toute simple, sans dépendre de sendMessengerMessage ni de son fallback).
 * Trouvé le 24 août 2026 : le bot est resté muet 2 mois sans AUCUNE alerte parce que le
 * seul détecteur de panne (alertFbTokenDead) ne couvrait qu'un token mort — pas un envoi
 * qui échoue pour une autre raison. Ceci couvre le "et si ça recasse autrement demain".
 */
async function checkMessengerNotStuck(): Promise<void> {
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from("messenger_conversations")
      .select("sender_id, sender_name")
      .is("last_handled_mid", null)
      .gte("updated_at", fifteenMinAgo)
      .limit(5);

    if (!stuck || stuck.length === 0) return;

    // Anti-répétition : max 1 alerte / 2h tant que le problème persiste (sinon spam
    // toutes les 5 min = pire que le silence qu'on essaie de corriger).
    const TWO_H = 2 * 60 * 60 * 1000;
    const { data: last } = await supabase
      .from("app_settings").select("value, updated_at").eq("key", "messenger_watchdog_alert_at").maybeSingle();
    if (last?.updated_at && Date.now() - new Date(last.updated_at).getTime() < TWO_H) return;
    await supabase.from("app_settings")
      .upsert({ key: "messenger_watchdog_alert_at", value: "1", updated_at: new Date().toISOString() }, { onConflict: "key" });

    await notifySystemAlert(
      `🚨 MESSENGER SEMBLE CASSÉ — ${stuck.length} client(s) récent(s) sans réponse depuis plus de 15 min.\n` +
      `Ce n'est PAS l'alerte habituelle par client — celle-là dit que le problème persiste globalement.\n` +
      `Vérifie /api/health et /api/admin/messenger-diag.`
    );
    const phone = process.env.LUCA_PHONE || process.env.MELYNDA_PHONE;
    if (phone) {
      await sendSMS(
        phone,
        `🚨 Messenger semble casse — ${stuck.length} client(s) sans reponse depuis 15+ min. Verifie le site.`,
        "messenger_watchdog"
      ).catch(() => {});
    }
  } catch {
    // Le chien de garde ne doit jamais faire planter le cron lui-même.
  }
}

// Cron aux 5 min (filet de secours). Le webhook Messenger répond déjà EN DIRECT ; ce cron
// ne fait qu'UN seul passage pour rattraper un message manqué. Un passage par exécution
// (au lieu de l'ancienne boucle de 50s chaque minute) = coût Vercel réduit ~50x, sans
// impact réel pour le client (le webhook reste instantané).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Token de page auto-réparé (re-dérivé depuis le System User token au besoin).
  const TOKEN = await getFacebookToken();
  if (!TOKEN) return NextResponse.json({ error: "FACEBOOK_ACCESS_TOKEN manquant" }, { status: 500 });

  return await runCron("messenger-poll", async () => {
    const handledThisRun = new Set<string>();
    const { handled, errors } = await pollOnce(TOKEN, handledThisRun);
    await checkMessengerNotStuck(); // chien de garde indépendant, après le rattrapage normal
    return NextResponse.json({ ok: true, handled, errors: errors.slice(0, 10) });
  });
}
