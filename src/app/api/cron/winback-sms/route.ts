import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_PHONE_NUMBER) {
    return NextResponse.json({ ok: false, reason: "Twilio non configuré" });
  }

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoffDate = sixtyDaysAgo.toISOString().split("T")[0];

  // Récupérer tous les bookings completed pour trouver les inactifs
  const allBookings: { client_phone: string; client_name: string; date: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("client_phone, client_name, date")
      .eq("status", "completed")
      .not("client_phone", "is", null)
      .order("date", { ascending: false })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    allBookings.push(...data as { client_phone: string; client_name: string; date: string }[]);
    if (data.length < 1000) break;
    from += 1000;
    if (from > 20000) break;
  }

  // Grouper par phone → date du dernier RDV
  const lastVisitMap = new Map<string, { name: string; lastDate: string }>();
  for (const b of allBookings) {
    if (!b.client_phone) continue;
    const existing = lastVisitMap.get(b.client_phone);
    if (!existing || b.date > existing.lastDate) {
      lastVisitMap.set(b.client_phone, { name: b.client_name, lastDate: b.date });
    }
  }

  // Filtrer dormants (last visit > 60 jours mais < 120 jours pour éviter spam vieux)
  const oneTwentyDaysAgo = new Date();
  oneTwentyDaysAgo.setDate(oneTwentyDaysAgo.getDate() - 120);
  const oldestCutoff = oneTwentyDaysAgo.toISOString().split("T")[0];

  const dormant = Array.from(lastVisitMap.entries())
    .filter(([_, info]) => info.lastDate < cutoffDate && info.lastDate >= oldestCutoff)
    .slice(0, 30); // Limite 30 SMS par exécution pour budget

  // Vérifier qu'on n'a pas déjà envoyé un winback récemment (table sms_blacklist sert aussi de log)
  const { data: recentSent } = await supabaseAdmin
    .from("sms_blacklist")
    .select("phone")
    .ilike("reason", "%winback%")
    .gte("created_at", new Date(Date.now() - 30*24*60*60*1000).toISOString())
    .range(0, 999);
  const recentSentSet = new Set((recentSent || []).map(r => r.phone));

  let sent = 0;
  let skipped = 0;

  for (const [phone, info] of dormant) {
    if (recentSentSet.has(phone)) { skipped++; continue; }
    try {
      const firstName = info.name?.split(" ")[0] || "";
      const message = `Salut ${firstName} ✂️\nCa fait un bout qu'on s'est pas vu chez Ciseau Noir ! Melynda aimerait te revoir. Reserve ton prochain RDV : ciseaunoirbarbershop.com/booking`;
      // sendSMS() check automatiquement isBlacklisted + dedup 24h via sms_log
      await sendSMS(phone, message, "winback-60d");
      // Log winback envoyé (réutilise sms_blacklist comme log de dedupe à 30j)
      await supabaseAdmin.from("sms_blacklist").insert([{ phone, reason: "winback-sent-" + new Date().toISOString().split("T")[0] }]).then(() => {}, () => {});
      sent++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, dormant_found: dormant.length, sent, skipped });
}
