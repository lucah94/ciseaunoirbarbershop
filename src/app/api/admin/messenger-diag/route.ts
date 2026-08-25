import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getFacebookToken } from "@/lib/fbToken";
import { sendMessengerMessage } from "@/app/api/meta/messenger/route";

export const dynamic = "force-dynamic";

/**
 * Diagnostic Messenger — cause EXACTE pour laquelle des vrais clients ne reçoivent pas
 * de réponse. Les checks de /api/health confirment que le token et le webhook sont
 * vivants ; ceci va plus loin : ça tente un VRAI appel Graph (profil d'un expéditeur
 * réel qui a déjà écrit) et rapporte l'erreur brute de Meta, qui dit ce que la
 * "santé" du token ne peut pas dire.
 *
 * Cause la plus probable : permission pages_messaging en accès STANDARD (mode Dev),
 * pas encore en accès AVANCÉ via App Review — dans ce mode, Facebook livre bien les
 * messages entrants au webhook (d'où les conversations en base), mais bloque l'envoi
 * de messages sortants et la lecture de profil vers qui que ce soit qui n'est pas
 * admin/développeur/testeur de l'app. Symptôme exact observé : bot muet avec de vrais
 * clients.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { data: recentConvos } = await supabaseAdmin
    .from("messenger_conversations")
    .select("sender_id, sender_name, last_handled_mid, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const token = await getFacebookToken();
  const testSenderId = recentConvos?.[0]?.sender_id;

  let profileTest: { ok: boolean; status?: number; body?: string } | null = null;
  if (testSenderId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${testSenderId}?fields=first_name&access_token=${encodeURIComponent(token)}`
      );
      const body = await res.text();
      profileTest = { ok: res.ok, status: res.status, body: body.slice(0, 500) };
    } catch (e) {
      profileTest = { ok: false, body: e instanceof Error ? e.message : "erreur réseau" };
    }
  }

  // Statut de l'app côté Meta — confirme si on est en mode Développement (compte, en gros).
  let appMode: { ok: boolean; status?: number; body?: string } | null = null;
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appId && appSecret) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${appId}?fields=id,name&access_token=${appId}|${appSecret}`
      );
      const body = await res.text();
      appMode = { ok: res.ok, status: res.status, body: body.slice(0, 500) };
    } catch (e) {
      appMode = { ok: false, body: e instanceof Error ? e.message : "erreur réseau" };
    }
  }

  // Test d'ENVOI réel — seulement si on nous donne explicitement un destinataire
  // (jamais de PSID au hasard : on ne texte pas un vrai client pour tester).
  // Usage: /api/admin/messenger-diag?testSendTo=<sender_id>
  const testSendTo = req.nextUrl.searchParams.get("testSendTo");
  let sendTest: { ok: boolean; authError?: boolean; detail?: string } | null = null;
  if (testSendTo) {
    sendTest = await sendMessengerMessage(
      testSendTo,
      "🔧 Test système Ciseau Noir — ignore ce message, on vérifie que le bot peut répondre."
    );
  }

  return NextResponse.json({
    recentConversations: recentConvos || [],
    diagnosis: "Si toutes les 'last_handled_mid' sont null malgré des 'updated_at' récents → l'envoi échoue à chaque fois. Voir profileTest.body pour l'erreur brute Meta.",
    profileTest,
    appMode,
    sendTest,
  });
}
