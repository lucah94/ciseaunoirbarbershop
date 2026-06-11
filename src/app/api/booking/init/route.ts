import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Normalise un nom de barbier : minuscules + sans accents (règle "stephanie" vs "stéphanie")
const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export async function GET() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Tous les barbiers actifs + TOUS les blocages/dispos (on regroupe par barbier côté serveur)
  const [barbersRes, blocksRes, overridesRes] = await Promise.all([
    supabaseAdmin.from("barbers").select("name, schedule, active, color, role").eq("active", true).order("created_at", { ascending: true }),
    supabaseAdmin.from("barber_blocks").select("*").gte("date", todayStr),
    supabaseAdmin.from("barber_day_overrides").select("*").gte("date", todayStr),
  ]);

  const allBlocks = blocksRes.data ?? [];
  const allOverrides = overridesRes.data ?? [];

  const barbers = (barbersRes.data ?? []).map((b) => {
    const key = norm(b.name);
    return {
      name: b.name,
      schedule: b.schedule ?? {},
      color: b.color ?? "#D4AF37",
      role: b.role ?? "",
      blocks: allBlocks.filter((x) => norm(x.barber) === key),
      overrides: allOverrides.filter((x) => norm(x.barber) === key),
    };
  });

  return NextResponse.json({ barbers });
}
