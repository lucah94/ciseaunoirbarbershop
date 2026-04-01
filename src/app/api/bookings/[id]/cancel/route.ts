import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function htmlPage(title: string, emoji: string, body: string, gold = false) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Ciseau Noir</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0A0A; color: #F5F5F5; font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { max-width: 460px; width: 100%; text-align: center; }
    .emoji { font-size: 48px; margin-bottom: 24px; }
    .label { color: #C9A84C; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-weight: 300; font-size: 28px; letter-spacing: 3px; margin-bottom: 16px; }
    .divider { width: 40px; height: 2px; background: ${gold ? "#C9A84C" : "#333"}; margin: 0 auto 24px; }
    p { color: #888; font-size: 14px; line-height: 1.8; margin-bottom: 12px; }
    .info { background: #111; border: 1px solid #1A1A1A; padding: 16px 20px; margin: 24px 0; text-align: left; }
    .info p { color: #666; font-size: 13px; }
    .info span { color: #F5F5F5; }
    a.btn { display: inline-block; margin-top: 24px; background: #C9A84C; color: #0A0A0A; padding: 12px 32px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; }
    .phone { color: #C9A84C; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, client_name, service, barber, date, time, status")
    .eq("id", id)
    .single();

  if (error || !booking) {
    return htmlPage("Introuvable", "❓", `
      <p class="label">Ciseau Noir</p>
      <div class="emoji">❓</div>
      <h1>Rendez-vous introuvable</h1>
      <div class="divider"></div>
      <p>Ce lien est invalide ou le rendez-vous n'existe plus.</p>
      <p class="phone">Questions ? (418) 665-5703</p>
    `);
  }

  if (booking.status === "cancelled") {
    return htmlPage("Déjà annulé", "✓", `
      <p class="label">Ciseau Noir</p>
      <div class="emoji">✓</div>
      <h1>Déjà annulé</h1>
      <div class="divider"></div>
      <p>Ce rendez-vous a déjà été annulé.</p>
      <a class="btn" href="${process.env.NEXT_PUBLIC_SITE_URL}/booking">Nouveau rendez-vous</a>
    `);
  }

  const bookingDate = new Date(booking.date + "T12:00:00");
  if (bookingDate < new Date()) {
    return htmlPage("Passé", "📅", `
      <p class="label">Ciseau Noir</p>
      <div class="emoji">📅</div>
      <h1>Rendez-vous passé</h1>
      <div class="divider"></div>
      <p>Impossible d'annuler un rendez-vous passé.</p>
      <p class="phone">(418) 665-5703</p>
    `);
  }

  // Cancel the booking
  await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", id);

  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return htmlPage("Annulé", "✓", `
    <p class="label">Ciseau Noir</p>
    <div class="emoji">✂️</div>
    <h1>Rendez-vous annulé</h1>
    <div class="divider"></div>
    <div class="info">
      <p><span>${booking.service}</span> avec ${booking.barber}</p>
      <p>📅 <span>${dateFormatted} à ${booking.time}</span></p>
    </div>
    <p>Votre rendez-vous a été annulé avec succès.</p>
    <a class="btn" href="${process.env.NEXT_PUBLIC_SITE_URL}/booking">Reprendre un rendez-vous</a>
    <p class="phone">Questions ? (418) 665-5703</p>
  `, true);
}
