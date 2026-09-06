import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendSMS, formatPhone } from "@/lib/sms";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export const maxDuration = 300;

async function getUniquePhones() {
  // Pagination — Supabase plafonne une requête sans .range() à 1000 lignes par défaut.
  // La table a 3500+ RDV : sans ça, seule une fraction arbitraire des clients était
  // lue, et un SMS de masse en ratait silencieusement ~800 sans aucune erreur visible
  // (trouvé le 6 sept 2026 — le SMS de déménagement n'a rejoint que 324/1127 clients).
  const PAGE_SIZE = 1000;
  const all: { client_phone: string; client_name: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("bookings")
      .select("client_phone, client_name")
      .not("client_phone", "is", null)
      .neq("client_phone", "")
      .neq("client_phone", "418-555-0000")
      .neq("client_phone", "418-555-9999")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Déduplique par numéro formaté — même numéro sous 2 noms = 1 seul SMS
  const seen = new Set<string>();
  return all.filter(c => {
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

  const { message, excludePhonesSentSince } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }

  let unique;
  try { unique = await getUniquePhones(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  // Exclut les numéros déjà avertis depuis une date donnée — sert à rattraper les
  // clients oubliés par le bug de pagination sans re-texter ceux déjà rejoints.
  let excludeSet = new Set<string>();
  if (excludePhonesSentSince) {
    const { data: already } = await supabase
      .from("sms_log").select("phone").gte("sent_at", excludePhonesSentSince);
    excludeSet = new Set((already || []).map((r: { phone: string }) => r.phone.replace(/\D/g, "").slice(-10)));
  }

  const sent: string[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  for (const contact of unique) {
    const phone = formatPhone(contact.client_phone);
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (excludeSet.has(digits)) { skipped.push(phone); continue; }
    try {
      await sendSMS(phone, message);
      sent.push(phone);
      await new Promise(r => setTimeout(r, 80));
    } catch {
      failed.push(contact.client_phone);
    }
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length, skipped: skipped.length, total: unique.length });
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
