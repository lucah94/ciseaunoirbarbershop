import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const name = (body.name ?? "").trim();
  const price = Number(body.price);
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "price invalide" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("services")
    .insert({
      name,
      price,
      duration_min: body.duration_min,
      description: body.description ?? null,
      icon: body.icon ?? null,
      sort_order: body.sort_order ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("services")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await supabaseAdmin.from("services").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
