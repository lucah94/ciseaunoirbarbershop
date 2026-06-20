import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
export const dynamic = 'force-dynamic';

// Compte groupé des visites fidélité pour une liste de courriels.
// Renvoie { "email": nbVisites, ... } en une seule requête DB.
async function countVisitsByEmails(emails: string[]) {
  const result: Record<string, number> = {};
  const unique = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  if (unique.length === 0) return result;

  for (const e of unique) result[e] = 0;

  const { data, error } = await supabase
    .from("bookings")
    .select("client_email")
    .eq("loyalty_counted", true)
    .in("client_email", unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const e = (row as { client_email: string | null }).client_email;
    if (e && e in result) result[e] += 1;
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    const emailsParam = searchParams.get("emails");

    // Mode BATCH : ?emails=a@x.com,b@y.com → { "a@x.com": n, ... }
    if (emailsParam) {
      const emails = emailsParam.split(",");
      const counts = await countVisitsByEmails(emails);
      return NextResponse.json(counts);
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Paramètre email ou phone requis" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("loyalty_counted", true);

    if (email) {
      query = query.eq("client_email", email);
    } else if (phone) {
      query = query.eq("client_phone", phone);
    }

    const { count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const visits = count ?? 0;
    const progress = visits % 10;
    const nextFree = progress === 9;
    const isFree = progress === 0 && visits > 0;

    return NextResponse.json({ visits, progress, nextFree, isFree });
  } catch (e) {
    console.error("Loyalty GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Mode BATCH (POST) : { emails: [...] } → { "email": nbVisites, ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emails = Array.isArray(body?.emails) ? (body.emails as unknown[]).filter((e): e is string => typeof e === "string") : [];

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "Paramètre emails (tableau) requis" },
        { status: 400 }
      );
    }

    const counts = await countVisitsByEmails(emails);
    return NextResponse.json(counts);
  } catch (e) {
    console.error("Loyalty POST error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
