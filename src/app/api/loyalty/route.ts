import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");

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
