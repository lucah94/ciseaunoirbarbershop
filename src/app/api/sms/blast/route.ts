import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendSMS, formatPhone } from "@/lib/sms";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }

  // Fetch all unique phone numbers from contacts
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("phone, first_name")
    .not("phone", "is", null)
    .neq("phone", "");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Déduplique les numéros formatés — un même numéro sous 2 noms différents = 1 seul SMS
  const seen = new Set<string>();
  const unique = (contacts ?? []).filter(c => {
    const formatted = formatPhone(c.phone);
    if (formatted.length < 10) return false;
    if (seen.has(formatted)) return false;
    seen.add(formatted);
    return true;
  });

  const sent: string[] = [];
  const failed: string[] = [];

  for (const contact of unique) {
    try {
      const phone = formatPhone(contact.phone);
      await sendSMS(phone, message);
      sent.push(phone);
      // Small delay to avoid Twilio rate limits
      await new Promise(r => setTimeout(r, 80));
    } catch {
      failed.push(contact.phone);
    }
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length, total: (contacts ?? []).length });
}

export async function GET() {
  // Returns count of contacts with phone numbers
  const { count, error } = await supabase
    .from("contacts")
    .select("phone", { count: "exact", head: true })
    .not("phone", "is", null)
    .neq("phone", "");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
