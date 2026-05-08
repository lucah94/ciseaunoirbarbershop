import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const [barbers, melBlocks, melOverrides, dioBlocks, dioOverrides] = await Promise.all([
    supabaseAdmin.from("barbers").select("name, schedule"),
    supabaseAdmin.from("barber_blocks").select("*").eq("barber", "melynda").gte("date", todayStr),
    supabaseAdmin.from("barber_day_overrides").select("*").eq("barber", "melynda").gte("date", todayStr),
    supabaseAdmin.from("barber_blocks").select("*").eq("barber", "diodis").gte("date", todayStr),
    supabaseAdmin.from("barber_day_overrides").select("*").eq("barber", "diodis").gte("date", todayStr),
  ]);

  return NextResponse.json({
    barbers: barbers.data ?? [],
    melynda: { blocks: melBlocks.data ?? [], overrides: melOverrides.data ?? [] },
    diodis: { blocks: dioBlocks.data ?? [], overrides: dioOverrides.data ?? [] },
  });
}
