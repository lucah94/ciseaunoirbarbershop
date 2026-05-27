import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Admin OU barber peuvent lire les blocs (Melynda voit ses blocks aussi)
  const adminDenied = requireAdmin(req);
  if (adminDenied) {
    // Check si c'est un barber
    const auth = req.cookies.get("barber_auth");
    if (!auth) return adminDenied;
  }

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

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("barber_blocks").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
