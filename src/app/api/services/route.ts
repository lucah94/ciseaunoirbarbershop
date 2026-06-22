import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { FALLBACK_API_SERVICES as FALLBACK } from "@/lib/services-fallback";
export const dynamic = 'force-dynamic';

// Liste de secours = données actuelles (centralisée dans @/lib/services-fallback).
// Sert si la DB échoue ou renvoie vide, pour ne JAMAIS casser le booking
// (jamais de 500 ni de tableau vide).

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("id,name,price,duration_min,description,icon,sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error || !data || data.length === 0) return NextResponse.json(FALLBACK);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
