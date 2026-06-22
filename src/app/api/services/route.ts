import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = 'force-dynamic';

// Liste de secours = données actuelles. Sert si la DB échoue ou renvoie vide,
// pour ne JAMAIS casser le booking (jamais de 500 ni de tableau vide).
const FALLBACK = [
  { name: "Coupe + Lavage", price: 35, duration_min: 45, description: "Coupe classique avec shampoing", icon: "✂️" },
  { name: "Coupe + Barbe à la lame", price: 50, duration_min: 60, description: "Coupe, rasage lame", icon: "🪒" },
  { name: "Coupe + Barbe Shaver", price: 45, duration_min: 45, description: "Coupe, barbe au shaver", icon: "🧔" },
  { name: "Service Premium", price: 75, duration_min: 75, description: "Coupe, rasage, serviette chaude", icon: "👑" },
  { name: "Rasage / Barbe au shaver", price: 25, duration_min: 30, description: "Rasage & barbe au shaver", icon: "🧔" },
  { name: "Rasage / Barbe à la lame", price: 30, duration_min: 30, description: "Rasage & barbe à la lame", icon: "🪒" },
  { name: "Enfant (12 ans et moins)", price: 30, duration_min: 30, description: "Coupe enfant 12 ans et moins", icon: "👦" },
];

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
