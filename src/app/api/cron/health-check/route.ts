import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Restart Supabase via Management API
async function restartSupabase(): Promise<boolean> {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return false;

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/restart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Attendre que Supabase revienne en ligne (max ~90s)
async function waitForSupabase(): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 10000)); // attendre 10s
    try {
      const { error } = await supabaseAdmin.from("bookings").select("id").limit(1);
      if (!error) return true;
    } catch {}
  }
  return false;
}

async function checkHealth(): Promise<{ ok: boolean; broken: string[] }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const broken = Object.entries(data.checks as Record<string, { status: string; message?: string }>)
      .filter(([, v]) => v.status === "error")
      .map(([k, v]) => `• ${k}: ${v.message ?? "erreur"}`);
    return { ok: broken.length === 0, broken };
  } catch (e) {
    return { ok: false, broken: [`• site: inaccessible (${String(e)})`] };
  }
}

async function sendAlert(broken: string[], status: "auto_repaired" | "alert") {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
  const lucaPhone = process.env.LUCA_PHONE;
  const melyndaPhone = process.env.MELYNDA_PHONE;

  const msg = status === "auto_repaired"
    ? `⚠️ CISEAU NOIR — Panne détectée mais réparée automatiquement ✅\n\nService(s) qui ont eu un problème:\n${broken.join("\n")}\n\nTout est revenu en ligne automatiquement.`
    : `🚨 CISEAU NOIR — PANNE NON RÉSOLUE\n\nService(s) en erreur:\n${broken.join("\n")}\n\nAction requise: vérifier Supabase (supabase.com/dashboard)\nSite: ${baseUrl}/admin/sante`;

  const promises = [];
  if (lucaPhone) promises.push(sendSMS(lucaPhone, msg));
  if (status === "alert" && melyndaPhone) promises.push(sendSMS(melyndaPhone, msg));
  await Promise.allSettled(promises);
}

export async function GET() {
  try {
    // 1. Vérification initiale
    const initial = await checkHealth();
    if (initial.ok) {
      return NextResponse.json({ status: "ok" });
    }

    // 2. Panne détectée — restart Supabase automatique
    const restarted = await restartSupabase();

    if (restarted) {
      // Attendre que Supabase revienne en ligne
      const backOnline = await waitForSupabase();

      if (backOnline) {
        // Re-vérification complète
        const recheck = await checkHealth();
        if (recheck.ok) {
          await sendAlert(initial.broken, "auto_repaired");
          await supabaseAdmin.from("system_logs").insert({
            type: "auto_repaired",
            message: "Supabase redémarré et remis en ligne automatiquement",
            details: { broken: initial.broken },
            created_at: new Date().toISOString(),
          }).then(() => {}, () => {});
          return NextResponse.json({ status: "auto_repaired", broken: initial.broken });
        }
      }
    }

    // 3. Toujours brisé — SMS urgent
    const recheck = await checkHealth();
    await sendAlert(recheck.broken.length > 0 ? recheck.broken : initial.broken, "alert");
    await supabaseAdmin.from("system_logs").insert({
      type: "health_alert",
      message: "Panne non résolue malgré tentative de restart",
      details: { broken: initial.broken, restarted },
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json({ status: "alert_sent", broken: initial.broken }, { status: 503 });

  } catch (e) {
    const lucaPhone = process.env.LUCA_PHONE;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    if (lucaPhone) {
      await sendSMS(lucaPhone, `🚨 CISEAU NOIR — SITE HORS LIGNE\n\nLe site ne répond plus du tout.\nsupabase.com/dashboard → restart le projet\n\nErreur: ${String(e)}`).then(() => {}, () => {});
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
