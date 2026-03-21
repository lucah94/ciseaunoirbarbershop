import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("portfolio")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("admin_auth");
  if (cookie?.value !== "true") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { url, caption, tags, barber } = body;
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  const { data, error } = await supabase
    .from("portfolio")
    .insert({ url, caption, tags, barber })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get("admin_auth");
  if (cookie?.value !== "true") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabase.from("portfolio").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
