import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { sendSMS } from "@/lib/sms";
import { montrealParts } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { month, day } = montrealParts();
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Trouver clients dont birthday = aujourd'hui (champ birthday optionnel sur clients)
  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, email, phone, birthday")
    .not("birthday", "is", null)
    .range(0, 9999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayBirthdays = (clients || []).filter(c => {
    if (!c.birthday) return false;
    const bday = String(c.birthday);
    return bday.includes(mmdd) || bday.endsWith(mmdd) || bday.slice(5, 10) === mmdd;
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const twilioReady = !!process.env.TWILIO_ACCOUNT_SID;

  let sent_emails = 0;
  let sent_sms = 0;

  for (const c of todayBirthdays) {
    const firstName = c.name?.split(" ")[0] || "";

    if (c.email && resend) {
      try {
        await resend.emails.send({
          from: process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>",
          to: c.email,
          subject: `Joyeux anniversaire ${firstName} ! 🎂 -20% sur ton prochain RDV`,
          html: `
            <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto; text-align:center;">
              <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase;">Ciseau Noir</p>
              <h1 style="font-weight: 300; font-size: 36px; letter-spacing: 2px;">Joyeux anniversaire ${firstName} ! 🎂</h1>
              <div style="width: 60px; height: 2px; background: #C9A84C; margin: 24px auto;"></div>
              <p style="color: #BBB; font-size: 16px;">Pour fêter ça, on t'offre <strong style="color:#C9A84C;">20% de rabais</strong> sur ton prochain rendez-vous.</p>
              <p style="color: #999; font-size: 14px;">Valide pendant 30 jours. Code: <strong>BDAY-${firstName.toUpperCase()}</strong></p>
              <a href="https://ciseaunoirbarbershop.com/booking" style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 32px; text-decoration: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; margin-top: 24px;">Réserver mon RDV</a>
              <p style="color: #777; font-size: 12px; margin-top: 32px;">— Melynda ✂️</p>
            </div>
          `,
        });
        sent_emails++;
      } catch {}
    }

    if (c.phone && twilioReady) {
      try {
        await sendSMS(
          c.phone,
          `🎂 Joyeux anniversaire ${firstName} ! -20% sur ton prochain RDV chez Ciseau Noir. Code: BDAY-${firstName.toUpperCase()}. Reserve: ciseaunoirbarbershop.com/booking ✂️`,
          "birthday"
        );
        sent_sms++;
      } catch {}
    }
  }

  return NextResponse.json({ ok: true, birthdays_today: todayBirthdays.length, sent_emails, sent_sms });
}
