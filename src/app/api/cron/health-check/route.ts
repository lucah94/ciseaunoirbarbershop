import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

// Cron toutes les heures — vérifie la santé du système et alerte si bris
export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();

    const broken = Object.entries(data.checks as Record<string, { status: string; message?: string }>)
      .filter(([, v]) => v.status === "error")
      .map(([k, v]) => `${k}: ${v.message ?? "erreur"}`);

    if (broken.length > 0) {
      const melyndaPhone = process.env.MELYNDA_PHONE;
      const msg = `🚨 Ciseau Noir — Alerte système!\n\nService(s) en panne:\n${broken.join("\n")}\n\nVérifier: ${baseUrl}/admin/sante`;

      if (melyndaPhone) await sendSMS(melyndaPhone, msg);

      // Log dans Supabase
      try {
        await supabaseAdmin.from("system_logs").insert({
          type: "health_alert",
          message: msg,
          details: data.checks,
          created_at: new Date().toISOString(),
        });
      } catch { /* ignore si table n'existe pas encore */ }
    }

    return NextResponse.json({ checked: true, status: data.status, broken });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
