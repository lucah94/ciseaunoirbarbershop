import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json([]);
    }

    const search = q.trim();

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, email")
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      .order("name", { ascending: true })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e) {
    console.error("Clients GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
