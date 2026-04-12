import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendSMS, formatPhone } from "@/lib/sms";
import { requireAdmin } from "@/lib/auth";

export const maxDuration = 300;

async function getUniquePhones() {
  // Fetch all bookings with a phone number (excludes test numbers)
  const { data, error } = await supabase
    .from("bookings")
    .select("client_phone, client_name")
    .not("client_phone", "is", null)
    .neq("client_phone", "")
    .neq("client_phone", "418-555-0000")
    .neq("client_phone", "418-555-9999");

  if (error) throw new Error(error.message);

  // Déduplique par numéro formaté — même numéro sous 2 noms = 1 seul SMS
  const seen = new Set<string>();
  return (data ?? []).filter(c => {
    const formatted = formatPhone(c.client_phone);
    if (formatted.length < 12) return false; // numéro invalide
    if (seen.has(formatted)) return false;
    seen.add(formatted);
    return true;
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }

  let unique;
  try { unique = await getUniquePhones(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  const sent: string[] = [];
  const failed: string[] = [];

  for (const contact of unique) {
    try {
      const phone = formatPhone(contact.client_phone);
      await sendSMS(phone, message);
      sent.push(phone);
      await new Promise(r => setTimeout(r, 80));
    } catch {
      failed.push(contact.client_phone);
    }
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length, total: unique.length });
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const unique = await getUniquePhones();
    return NextResponse.json({ count: unique.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
