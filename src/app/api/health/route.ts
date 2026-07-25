import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFacebookToken, checkFacebookTokenHealth } from "@/lib/fbToken";
export const dynamic = 'force-dynamic';

type ServiceStatus = "ok" | "error" | "slow";
type Check = { status: ServiceStatus; latency: number; message?: string };

const TIMEOUT = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
}

async function checkSupabase(): Promise<Check> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin.from("bookings").select("id", { count: "exact", head: true });
    const latency = Date.now() - start;
    if (error) return { status: "error", latency, message: error.message };
    return { status: latency > 2000 ? "slow" : "ok", latency };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkResend(): Promise<Check> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const latency = Date.now() - start;
    return { status: res.ok ? "ok" : "error", latency, message: !res.ok ? `HTTP ${res.status}` : undefined };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkTwilio(): Promise<Check> {
  const start = Date.now();
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return { status: "error", latency: 0, message: "Credentials manquants" };
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const latency = Date.now() - start;
    if (!res.ok) return { status: "error", latency, message: `HTTP ${res.status}` };
    const data = await res.json();
    return { status: "ok", latency, message: `Solde: $${Number(data.balance).toFixed(2)} USD` };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkClaude(): Promise<Check> {
  const start = Date.now();
  try {
    // On vérifie OpenRouter (la vraie route AI), pas Anthropic direct.
    if (!process.env.OPENROUTER_API_KEY) return { status: "error", latency: 0, message: "Clé OpenRouter manquante" };
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const latency = Date.now() - start;
    return { status: res.ok ? "ok" : "error", latency, message: !res.ok ? `HTTP ${res.status}` : undefined };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkRLS(): Promise<Check> {
  const start = Date.now();
  const fallback: Check = { status: "ok", latency: TIMEOUT, message: "timeout ignoré" };
  return withTimeout(
    (async (): Promise<Check> => {
      try {
        const { data, error } = await supabaseAdmin.rpc("check_rls_status" as never);
        if (error) return { status: "ok", latency: Date.now() - start }; // ne pas bloquer si RPC échoue
        const unprotected = (data as { tablename: string; rowsecurity: boolean }[] || [])
          .filter(t => !t.rowsecurity).map(t => t.tablename);
        if (unprotected.length > 0) {
          return { status: "error", latency: Date.now() - start, message: `Tables sans RLS: ${unprotected.join(", ")}` };
        }
        return { status: "ok", latency: Date.now() - start };
      } catch (e) {
        return { status: "ok", latency: Date.now() - start, message: String(e) };
      }
    })(),
    TIMEOUT,
    fallback
  );
}

// Diagnostic Facebook/Messenger — pointe précisément où l'auto-réponse casse.
// N'expose AUCUN secret : seulement des booléens/statuts (ancre présente ? token vivant ?
// page abonnée au webhook Messenger ?).
async function checkFacebook(): Promise<Check> {
  const start = Date.now();
  try {
    const { ok, hasAnchor } = await checkFacebookTokenHealth();
    if (!hasAnchor) return { status: "error", latency: Date.now() - start, message: "Ancre FACEBOOK_SYSTEM_USER_TOKEN absente ou placeholder" };
    if (!ok) return { status: "error", latency: Date.now() - start, message: "Token de page invalide (Graph /me a échoué) — droits ou app à revoir" };
    // Token vivant → la page est-elle abonnée aux BONS champs webhook (messages…) ?
    const pageId = process.env.FACEBOOK_PAGE_ID || "577401682130596";
    const token = await getFacebookToken();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?fields=subscribed_fields&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const list = (data as { data?: { subscribed_fields?: string[] }[] })?.data;
    if (!Array.isArray(list) || list.length === 0) {
      return { status: "error", latency: Date.now() - start, message: "Token OK mais page NON abonnée au webhook — réabonnement requis" };
    }
    const fields = list.flatMap((a) => a.subscribed_fields || []);
    const hasMessages = fields.includes("messages");
    return {
      status: hasMessages ? "ok" : "error",
      latency: Date.now() - start,
      message: hasMessages
        ? `Token OK + abonné à 'messages' (champs: ${fields.join(",") || "?"})`
        : `Token OK mais PAS abonné au champ 'messages' — Messenger ne reçoit rien. Champs actuels: ${fields.join(",") || "aucun"}`,
    };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

export async function GET() {
  const [supabase, resend, twilio, claude, security, facebook] = await Promise.all([
    checkSupabase(),
    checkResend(),
    checkTwilio(),
    checkClaude(),
    checkRLS(),
    checkFacebook(),
  ]);

  const checks = { supabase, resend, twilio, claude, security, facebook };
  // Resend non-bloquant — email down ne déclenche pas d'alerte SMS
  const criticalChecks = { supabase, twilio };
  const hasError = Object.values(criticalChecks).some(c => c.status === "error");
  const hasSlow = Object.values(checks).some(c => c.status === "slow");
  const overall = hasError ? "error" : hasSlow ? "degraded" : "ok";

  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
  }, { status: hasError ? 503 : 200 });
}
