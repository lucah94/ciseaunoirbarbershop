import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";

function buildHtml(body: string) {
  return `
    <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
      <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 24px;">Ciseau Noir ✂️</p>
      <div style="color: #CCC; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">${body.replace(/\n/g, "<br>")}</div>
      <div style="border-top: 1px solid #1A1A1A; padding-top: 20px; margin-top: 20px;">
        <p style="color: #444; font-size: 11px; margin: 0; line-height: 1.7;">
          📍 375 Bd des Chutes, Québec · 📞 (418) 665-5703 · ciseaunoirbarbershop.com
        </p>
        <p style="color: #333; font-size: 10px; margin-top: 12px;">
          Vous recevez cet email car vous avez visité Ciseau Noir Barbershop.
          <a href="mailto:ciseaunoirbarbershop@gmail.com?subject=Désabonnement" style="color: #555; text-decoration: underline;">Se désabonner</a>
        </p>
      </div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { subject, body_html, recipient_type } = await req.json();
    if (!subject || !body_html) {
      return NextResponse.json({ error: "subject et body_html requis" }, { status: 400 });
    }

    // Mode test — envoie seulement à Melynda
    if (recipient_type === "test") {
      const adminEmail = process.env.ADMIN_EMAIL || "ciseaunoirbarbershop@gmail.com";
      await resend.emails.send({
        from: FROM_EMAIL, to: adminEmail, subject,
        html: buildHtml(body_html),
      });
      return NextResponse.json({ sent: 1, test: true });
    }

    // Fetch recipients
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    let query = supabaseAdmin
      .from("bookings")
      .select("client_email")
      .not("client_email", "is", null)
      .neq("client_email", "")
      .neq("client_email", "test@test.com");

    if (recipient_type === "recent") {
      query = query.gte("date", cutoff.toISOString().split("T")[0]);
    }

    const { data: rows } = await query;
    const emails = [...new Set((rows || []).map((r: { client_email: string }) => r.client_email).filter(Boolean))];

    if (emails.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Send in batches of 10
    const BATCH = 10;
    let sent = 0;
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH);
      await Promise.all(
        batch.map((email) =>
          resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject,
            html: buildHtml(body_html),
          }).catch(() => null)
        )
      );
      sent += batch.length;
      if (i + BATCH < emails.length) await new Promise(r => setTimeout(r, 200));
    }

    // Save campaign record
    await supabaseAdmin.from("email_campaigns").insert({ subject, body_html, sent_to_count: sent });

    return NextResponse.json({ sent });
  } catch (e) {
    console.error("Campaign error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
