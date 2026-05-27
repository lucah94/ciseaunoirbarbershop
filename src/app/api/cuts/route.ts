import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { requireAdmin, requireBarber } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Admin OU barber peuvent lire (Melynda voit ses cuts dans /barber, Luca voit tout dans /admin)
  const adminDenied = requireAdmin(req);
  const barberDenied = requireBarber(req);
  if (adminDenied && barberDenied) return adminDenied;

  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week"); // format: YYYY-Www

  let weekStart: string | null = null;
  let weekEnd: string | null = null;
  if (week) {
    const [year, w] = week.split("-W").map(Number);
    const jan4 = new Date(year, 0, 4);
    const startOfWeek = new Date(jan4);
    startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    weekStart = startOfWeek.toISOString().split("T")[0];
    weekEnd = endOfWeek.toISOString().split("T")[0];
  }

  // Pagination côté serveur — évite la limite hard Supabase 1000
  const PAGE_SIZE = 1000;
  const all: unknown[] = [];
  let from = 0;
  while (true) {
    let query = supabase.from("cuts").select("*").order("date", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (weekStart && weekEnd) query = query.gte("date", weekStart).lte("date", weekEnd);
    const { data: page, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!page || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 50000) break;
  }
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { data, error } = await supabase.from("cuts").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const { error } = await supabase.from("cuts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
