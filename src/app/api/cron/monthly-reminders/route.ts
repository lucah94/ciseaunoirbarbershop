import { NextRequest, NextResponse } from "next/server";
import { notifySystemAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Runs on the 1st of every month at 9am
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = req.nextUrl.searchParams.get("secret") || req.nextUrl.searchParams.get("key");
    if (bearer !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

  const alerts: string[] = [];

  // 1st of month — rent reminder
  if (day === 1) {
    alerts.push(
      `🏠 <b>LOYER — À PAYER AUJOURD'HUI</b>\n` +
      `C'est le 1er ${month}.\n` +
      `Assure-toi que le virement est envoyé avant la fin de la journée.`
    );
  }

  // 1st of month — check if insurance renewal is coming up (within 30 days)
  // ECGL renewal is May 8 — hardcoded for now, update yearly
  const insuranceRenewal = new Date("2026-05-08");
  const daysToInsurance = Math.ceil((insuranceRenewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysToInsurance > 0 && daysToInsurance <= 30) {
    alerts.push(
      `🛡️ <b>ASSURANCE — RENOUVELLEMENT DANS ${daysToInsurance} JOURS</b>\n` +
      `Renouvellement ECGL — ${insuranceRenewal.toLocaleDateString("fr-CA")}\n` +
      `Contact: Steven Morin (smorin@ellipse.ca)`
    );
  }

  // Send all alerts
  for (const alert of alerts) {
    await notifySystemAlert(alert).catch(() => {});
  }

  return NextResponse.json({ sent: alerts.length, day });
}
