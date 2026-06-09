import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  // Fetch all active barbers + their blocks + day overrides en parallèle
  const [barbersRes, melBlocks, melOverrides, stephanieBlocks, stephanieOverrides] = await Promise.all([
    supabaseAdmin.from("barbers").select("name, schedule, active").eq("active", true),
    supabaseAdmin.from("barber_blocks").select("*").eq("barber", "melynda").gte("date", todayStr),
    supabaseAdmin.from("barber_day_overrides").select("*").eq("barber", "melynda").gte("date", todayStr),
    supabaseAdmin.from("barber_blocks").select("*").eq("barber", "stephanie").gte("date", todayStr),
    supabaseAdmin.from("barber_day_overrides").select("*").eq("barber", "stephanie").gte("date", todayStr),
  ]);

  return NextResponse.json({
    barbers: barbersRes.data ?? [],
    melynda: { blocks: melBlocks.data ?? [], overrides: melOverrides.data ?? [] },
    stephanie: { blocks: stephanieBlocks.data ?? [], overrides: stephanieOverrides.data ?? [] },
  });
}
