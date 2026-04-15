import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function getNextDate(baseDate: string, pattern: string, index: number): string {
  if (pattern === "weekly") return addWeeks(baseDate, index);
  if (pattern === "biweekly") return addWeeks(baseDate, index * 2);
  if (pattern === "monthly") return addMonths(baseDate, index);
  return baseDate;
}

// POST /api/bookings/recurring — créer une série de RDV récurrents
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const {
    client_name, client_phone, client_email,
    barber, service, price, date, time, note,
    recurrence_pattern, // 'weekly' | 'biweekly' | 'monthly'
    recurrence_count = 8, // nombre de RDV à créer
  } = body;

  if (!client_name || !date || !time || !recurrence_pattern) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const group_id = crypto.randomUUID();
  const bookings = [];

  for (let i = 0; i < recurrence_count; i++) {
    bookings.push({
      client_name,
      client_phone: client_phone || "",
      client_email: client_email || "",
      barber,
      service,
      price,
      date: getNextDate(date, recurrence_pattern, i),
      time,
      note: note || "",
      status: "confirmed",
      recurring_group_id: group_id,
      recurrence_pattern,
    });
  }

  const { data, error } = await supabase.from("bookings").insert(bookings).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: data.length, group_id });
}

// DELETE /api/bookings/recurring?group_id=xxx — annuler tous les futurs RDV d'un groupe
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get("group_id");
  if (!group_id) return NextResponse.json({ error: "group_id requis" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("recurring_group_id", group_id)
    .eq("status", "confirmed")
    .gte("date", today);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
