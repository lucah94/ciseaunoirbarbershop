import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    const broken = Object.entries(data.checks as Record<string, { status: string; message?: string }>)
      .filter(([, v]) => v.status === "error")
      .map(([k, v]) => `• ${k}: ${v.message ?? "erreur"}`);

    if (broken.length > 0) {
      const lucaPhone = process.env.LUCA_PHONE;
      const melyndaPhone = process.env.MELYNDA_PHONE;
      const msg = `🚨 CISEAU NOIR — PANNE DÉTECTÉE\n\nService(s) en erreur:\n${broken.join("\n")}\n\nLe site ou le booking peut être affecté.\nVérifier: ${baseUrl}/admin/sante`;

      const promises = [];
      if (lucaPhone) promises.push(sendSMS(lucaPhone, msg));
      if (melyndaPhone) promises.push(sendSMS(melyndaPhone, msg));
      await Promise.allSettled(promises);

      try {
        await supabaseAdmin.from("system_logs").insert({
          type: "health_alert",
          message: msg,
          details: data.checks,
          created_at: new Date().toISOString(),
        });
      } catch { /* ignore si table n'existe pas */ }

      return NextResponse.json({ status: "alert_sent", broken });
    }

    return NextResponse.json({ status: "ok", checked: true });
  } catch (e) {
    // Si le health check lui-même échoue (site complètement down), alerter Luca
    const lucaPhone = process.env.LUCA_PHONE;
    if (lucaPhone) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
      await sendSMS(lucaPhone, `🚨 CISEAU NOIR — SITE INACCESSIBLE\n\nLe site ne répond plus du tout.\nVérifier: ${baseUrl}\n\nErreur: ${String(e)}`).catch(() => {});
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
