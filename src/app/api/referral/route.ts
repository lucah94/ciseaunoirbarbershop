import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendReferralEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const referralSchema = z.object({
  referrer_email: z.string().email("Courriel du parrain invalide"),
  referrer_name: z.string().min(1, "Le nom du parrain est requis").max(100),
  referred_name: z.string().min(1, "Le nom de l'ami(e) est requis").max(100),
  referred_email: z.string().email("Courriel de l'ami(e) invalide"),
  referred_phone: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req, { limit: 5, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const result = referralSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const body = result.data;

  // Don't allow self-referral
  if (body.referrer_email.toLowerCase() === body.referred_email.toLowerCase()) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous référer vous-même." }, { status: 400 });
  }

  // Check if this referred email already has a pending/completed referral
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_email", body.referred_email.toLowerCase())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Cette personne a déjà été référée." }, { status: 400 });
  }

  const code = generateReferralCode();

  const { data, error } = await supabase
    .from("referrals")
    .insert([{
      referrer_email: body.referrer_email.toLowerCase(),
      referrer_name: body.referrer_name,
      referred_email: body.referred_email.toLowerCase(),
      referred_name: body.referred_name,
      referred_phone: body.referred_phone || null,
      code,
      status: "pending",
    }])
    .select()
    .single();

  if (error) {
    console.error("Referral insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send referral email to referred person
  try {
    await sendReferralEmail({
      referrer_name: body.referrer_name,
      referred_name: body.referred_name,
      referred_email: body.referred_email,
      code,
    });
  } catch (emailErr) {
    console.error("Referral email error:", emailErr);
  }

  return NextResponse.json({ ok: true, code, referral: data });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Le paramètre 'code' est requis" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Code de parrainage invalide" }, { status: 404 });
  }

  return NextResponse.json(data);
}
