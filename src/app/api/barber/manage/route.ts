import { NextRequest, NextResponse } from "next/server";
import { getAuthedBarber } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Gestion par un barbier de SES propres affaires (horaire, congés, journées exceptionnelles).
// Sécurité: getAuthedBarber vérifie que le jeton correspond bien au nom → impossible d'agir pour un autre.
export async function POST(req: NextRequest) {
  const me = getAuthedBarber(req);
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const slug = norm(me);

  const body = await req.json();
  const action = body.action as string;

  if (action === "schedule") {
    const { data: barbers } = await supabaseAdmin.from("barbers").select("id, name");
    const row = (barbers || []).find((b: { name: string }) => norm(b.name) === slug) as { id: string } | undefined;
    if (!row) return NextResponse.json({ error: "Barbier introuvable" }, { status: 404 });
    const { error } = await supabaseAdmin.from("barbers").update({ schedule: body.schedule || {} }).eq("id", row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "addBlock") {
    if (!body.date) return NextResponse.json({ error: "Date requise" }, { status: 400 });
    // start_time/end_time optionnels → bloque juste une plage d'heures dans la journée (sinon journée complète)
    const { data, error } = await supabaseAdmin.from("barber_blocks")
      .insert([{ barber: slug, date: body.date, reason: body.reason || null, start_time: body.start_time || null, end_time: body.end_time || null }]).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "removeBlock") {
    if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const { data: blk } = await supabaseAdmin.from("barber_blocks").select("barber").eq("id", body.id).single();
    if (!blk || norm((blk as { barber: string }).barber) !== slug) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    const { error } = await supabaseAdmin.from("barber_blocks").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "addOverride") {
    if (!body.date || !body.open || !body.close) return NextResponse.json({ error: "Champs requis" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("barber_day_overrides")
      .upsert({ barber: slug, date: body.date, open: body.open, close: body.close }, { onConflict: "barber,date" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "removeOverride") {
    if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const { data: ov } = await supabaseAdmin.from("barber_day_overrides").select("barber").eq("id", body.id).single();
    if (!ov || norm((ov as { barber: string }).barber) !== slug) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    const { error } = await supabaseAdmin.from("barber_day_overrides").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
