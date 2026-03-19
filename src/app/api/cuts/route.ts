import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week"); // format: YYYY-Www

  let query = supabase.from("cuts").select("*").order("date", { ascending: false });

  if (week) {
    // Get start and end of week
    const [year, w] = week.split("-W").map(Number);
    const jan4 = new Date(year, 0, 4);
    const startOfWeek = new Date(jan4);
    startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    query = query.gte("date", startOfWeek.toISOString().split("T")[0]).lte("date", endOfWeek.toISOString().split("T")[0]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from("cuts").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const { error } = await supabase.from("cuts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
