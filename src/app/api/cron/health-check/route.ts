import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHECK_TIMEOUT = 10000;
const COOLDOWN_HOURS = 6;

// ── Checks directs (plus de self-fetch qui timeout) ─────────────

async function checkSupabase(): Promise<{ ok: boolean; msg: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true });
    return error
      ? { ok: false, msg: `supabase: ${error.message}` }
      : { ok: true, msg: "" };
  } catch (e) {
    return { ok: false, msg: `supabase: ${String(e)}` };
  }
}

async function checkTwilio(): Promise<{ ok: boolean; msg: string }> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return { ok: false, msg: "twilio: credentials manquants" };
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(CHECK_TIMEOUT),
      }
    );
    return res.ok
      ? { ok: true, msg: "" }
      : { ok: false, msg: `twilio: HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, msg: `twilio: ${String(e)}` };
  }
}

async function runChecks(): Promise<string[]> {
  const [sb, tw] = await Promise.all([checkSupabase(), checkTwilio()]);
  return [sb, tw].filter(c => !c.ok).map(c => c.msg);
}

// ── Cooldown: pas de SMS si alerte envoyée récemment ─────────────

async function recentAlertExists(): Promise<boolean> {
  try {
    const cutoff = new Date(
      Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { data } = await supabaseAdmin
      .from("system_logs")
      .select("id")
      .eq("type", "health_alert")
      .gte("created_at", cutoff)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    // Si on ne peut pas vérifier, on laisse passer l'alerte
    return false;
  }
}

// ── Restart Supabase (seulement si Supabase est down) ────────────

async function restartSupabase(): Promise<boolean> {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return false;
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/restart`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForSupabase(): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 8000));
    const { ok } = await checkSupabase();
    if (ok) return true;
  }
  return false;
}

// ── Envoi d'alerte SMS ───────────────────────────────────────────

async function sendAlert(broken: string[], status: "auto_repaired" | "alert") {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
  const lucaPhone = process.env.LUCA_PHONE;
  const melyndaPhone = process.env.MELYNDA_PHONE;

  const msg =
    status === "auto_repaired"
      ? `⚠️ CISEAU NOIR — Panne détectée mais réparée automatiquement ✅\n\nService(s) touchés:\n${broken.map(b => `• ${b}`).join("\n")}\n\nTout est revenu en ligne.`
      : `🚨 CISEAU NOIR — PANNE\n\nService(s) en erreur:\n${broken.map(b => `• ${b}`).join("\n")}\n\nAction: supabase.com/dashboard\nSanté: ${baseUrl}/admin/sante`;

  const promises: Promise<void>[] = [];
  if (lucaPhone) promises.push(sendSMS(lucaPhone, msg).catch(() => {}));
  if (status === "alert" && melyndaPhone)
    promises.push(sendSMS(melyndaPhone, msg).catch(() => {}));
  await Promise.allSettled(promises);
}

function log(type: string, message: string, details: Record<string, unknown>) {
  return supabaseAdmin
    .from("system_logs")
    .insert({ type, message, details, created_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

// ── Handler principal ────────────────────────────────────────────

export async function GET(req: Request) {
  // Auth — empêche déclenchement non autorisé
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // 1. Check direct des services critiques
    const broken = await runChecks();
    if (broken.length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    // 2. Retry après 30s — évite les fausses alertes (cold start, glitch)
    await new Promise(r => setTimeout(r, 30000));
    const broken2 = await runChecks();
    if (broken2.length === 0) {
      return NextResponse.json({ status: "ok_after_retry" });
    }

    // 3. Cooldown — pas de SMS si alerte déjà envoyée dans les 6 dernières heures
    if (await recentAlertExists()) {
      await log("health_check_skipped", "Cooldown actif, SMS supprimé", {
        broken: broken2,
      });
      return NextResponse.json({ status: "cooldown", broken: broken2 });
    }

    // 4. Si Supabase est down → tenter un restart automatique
    const supabaseDown = broken2.some(b => b.startsWith("supabase"));
    if (supabaseDown) {
      const restarted = await restartSupabase();
      if (restarted) {
        const backOnline = await waitForSupabase();
        if (backOnline) {
          await sendAlert(broken2, "auto_repaired");
          await log("auto_repaired", "Supabase redémarré automatiquement", {
            broken: broken2,
          });
          return NextResponse.json({
            status: "auto_repaired",
            broken: broken2,
          });
        }
      }
    }

    // 5. Toujours en panne → SMS (une seule fois grâce au cooldown)
    await sendAlert(broken2, "alert");
    await log("health_alert", "Panne non résolue", { broken: broken2 });

    return NextResponse.json(
      { status: "alert_sent", broken: broken2 },
      { status: 503 }
    );
  } catch (e) {
    // Erreur catastrophique — respecter le cooldown quand même
    try {
      if (await recentAlertExists()) {
        return NextResponse.json(
          { error: String(e), cooldown: true },
          { status: 500 }
        );
      }
    } catch {}

    const lucaPhone = process.env.LUCA_PHONE;
    if (lucaPhone) {
      await sendSMS(
        lucaPhone,
        `🚨 CISEAU NOIR — Erreur health-check: ${String(e).slice(0, 100)}`
      ).catch(() => {});
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
