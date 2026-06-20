import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
export const dynamic = 'force-dynamic';

/**
 * GET /api/availability?date=YYYY-MM-DD — PUBLIC.
 * Retourne UNIQUEMENT l'occupation des créneaux pour une date, SANS aucune donnée client (PII).
 * Remplace l'usage de GET /api/bookings?date= côté réservation publique pour éviter la fuite
 * de nom/téléphone/courriel de tous les clients.
 * Réponse: [{ barber, time, end_time, service, status }]
 */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Paramètre ?date=AAAA-MM-JJ requis" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("barber, time, end_time, service, status")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("time", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aucun champ PII (client_name/phone/email/note) n'est sélectionné ni renvoyé.
    return NextResponse.json(data || []);
  } catch (e) {
    console.error("Availability GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
