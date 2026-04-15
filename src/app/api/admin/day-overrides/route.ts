import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const barber = req.nextUrl.searchParams.get("barber");
  const today = new Date().toISOString().split("T")[0];
  let query = supabaseAdmin.from("barber_day_overrides").select("*").gte("date", today).order("date");
  if (barber) query = query.eq("barber", barber);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("barber_day_overrides")
    .upsert({ barber: body.barber, date: body.date, open: body.open, close: body.close }, { onConflict: "barber,date" })
    .select()
    .single();
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("barber_day_overrides").delete().eq("id", id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
