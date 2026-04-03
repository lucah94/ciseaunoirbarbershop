import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Tentative de réparation automatique : wake-up Supabase
async function tryRepairSupabase(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      const { error } = await supabaseAdmin.from("bookings").select("id").limit(1);
      if (!error) return true; // réparé !
    } catch {}
    await new Promise(r => setTimeout(r, 3000)); // attendre 3s entre les tentatives
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

async function sendAlert(broken: string[], repaired: boolean) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
  const lucaPhone = process.env.LUCA_PHONE;
  const melyndaPhone = process.env.MELYNDA_PHONE;

  const msg = repaired
    ? `⚠️ CISEAU NOIR — Panne détectée mais réparée automatiquement ✅\n\nService(s) qui ont eu un problème:\n${broken.join("\n")}\n\nTout est revenu en ligne automatiquement.`
    : `🚨 CISEAU NOIR — PANNE NON RÉSOLUE\n\nService(s) en erreur:\n${broken.join("\n")}\n\nAction requise: vérifier Supabase (supabase.com/dashboard)\nSite: ${baseUrl}/admin/sante`;

  const promises = [];
  if (lucaPhone) promises.push(sendSMS(lucaPhone, msg));
  if (!repaired && melyndaPhone) promises.push(sendSMS(melyndaPhone, msg));
  await Promise.allSettled(promises);
}

export async function GET() {
  try {
    // 1. Vérification initiale
    const initial = await checkHealth();

    if (initial.ok) {
      return NextResponse.json({ status: "ok" });
    }

    // 2. Panne détectée — tentative de réparation automatique
    const supabaseFixed = await tryRepairSupabase();

    // 3. Re-vérification après réparation
    const recheck = await checkHealth();

    if (recheck.ok) {
      // Réparé tout seul — SMS d'info seulement à Luca
      await sendAlert(initial.broken, true);
      await supabaseAdmin.from("system_logs").insert({
        type: "auto_repaired", message: "Panne auto-réparée", details: { broken: initial.broken }, created_at: new Date().toISOString(),
      }).then(() => {}, () => {});
      return NextResponse.json({ status: "auto_repaired", broken: initial.broken });
    }

    // 4. Toujours brisé — SMS urgent à Luca + Melynda
    await sendAlert(recheck.broken, false);
    await supabaseAdmin.from("system_logs").insert({
      type: "health_alert", message: "Panne non résolue", details: { broken: recheck.broken, supabaseFixed }, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json({ status: "alert_sent", broken: recheck.broken }, { status: 503 });

  } catch (e) {
    // Site complètement mort
    const lucaPhone = process.env.LUCA_PHONE;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    if (lucaPhone) {
      await sendSMS(lucaPhone, `🚨 CISEAU NOIR — SITE HORS LIGNE\n\nLe site ne répond plus du tout.\nsupabase.com/dashboard → restart le projet\n\nErreur: ${String(e)}`).then(() => {}, () => {});
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
