import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseaunoirbarbershop.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ciseaunoirbarbershop@gmail.com";

const giftCardSchema = z.object({
  amount: z.number().min(10, "Montant minimum 10$").max(500, "Montant maximum 500$"),
  buyer_name: z.string().min(1, "Le nom est requis").max(100),
  buyer_email: z.string().email("Courriel invalide"),
  recipient_name: z.string().min(1, "Le nom du destinataire est requis").max(100),
  recipient_email: z.string().email("Courriel du destinataire invalide"),
  message: z.string().max(500).optional().or(z.literal("")),
});

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Paramètre code requis" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("gift_cards")
      .select("code, amount, status, recipient_name, created_at")
      .eq("code", code.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Carte cadeau introuvable" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Gift cards GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req, { limit: 5, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const result = giftCardSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const body = result.data;
  const code = generateCode();

  const { data, error } = await supabase
    .from("gift_cards")
    .insert([
      {
        code,
        amount: body.amount,
        buyer_name: body.buyer_name,
        buyer_email: body.buyer_email,
        recipient_name: body.recipient_name,
        recipient_email: body.recipient_email,
        message: body.message || "",
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send admin notification email
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Nouvelle carte cadeau — ${body.amount}$ de ${body.buyer_name}`,
      html: `
        <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
          <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
          <h1 style="font-weight: 300; font-size: 28px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Nouvelle carte cadeau</h1>
          <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>
          <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #1A1A1A;">
                <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Code</td>
                <td style="color: #C9A84C; font-size: 16px; font-weight: 600; padding: 12px 0; text-align: right; letter-spacing: 2px;">${code}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1A1A1A;">
                <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Montant</td>
                <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${body.amount}$</td>
              </tr>
              <tr style="border-bottom: 1px solid #1A1A1A;">
                <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Acheteur</td>
                <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${body.buyer_name} (${body.buyer_email})</td>
              </tr>
              <tr style="border-bottom: 1px solid #1A1A1A;">
                <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Destinataire</td>
                <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${body.recipient_name} (${body.recipient_email})</td>
              </tr>
              ${body.message ? `
              <tr>
                <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Message</td>
                <td style="color: #999; font-size: 13px; font-style: italic; padding: 12px 0; text-align: right;">${body.message}</td>
              </tr>` : ""}
            </table>
          </div>
          <p style="color: #888; font-size: 13px;">Statut : <strong style="color: #f90;">En attente de paiement</strong></p>
          <p style="color: #444; font-size: 12px; margin-top: 24px;">Contactez l'acheteur pour compléter le paiement, puis mettez à jour le statut.</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Gift card email error:", emailErr);
  }

  return NextResponse.json(data);
}
