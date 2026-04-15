import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const barber = req.nextUrl.searchParams.get("barber");
  let query = supabaseAdmin.from("barber_blocks").select("*").order("date");
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
    .from("barber_blocks")
    .insert({ barber: body.barber, date: body.date, reason: body.reason || null, start_time: body.start_time || null, end_time: body.end_time || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("barber_blocks").delete().eq("id", id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
