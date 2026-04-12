import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { data, error } = await supabaseAdmin
      .from("figaro_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (e) {
    console.error("Figaro messages GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, resolved } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    if (typeof resolved !== "boolean") {
      return NextResponse.json({ error: "resolved (boolean) requis" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("figaro_messages")
      .update({ resolved })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (e) {
    console.error("Figaro messages PATCH error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
