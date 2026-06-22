import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

// Agrégation des clients CÔTÉ SERVEUR (#8 perf).
// Reproduit À L'IDENTIQUE la logique qui était faite dans le navigateur
// sur /admin/clients (src/app/admin/clients/page.tsx) — mêmes chiffres,
// même tri par défaut. Voir ce fichier pour la logique d'origine.

type Booking = {
  client_name: string;
  client_phone: string;
  client_email: string;
  price: number;
  date: string;
  status: string;
  loyalty_counted: boolean;
};

type ClientStats = {
  name: string;
  phone: string;
  email: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string;
  noShowCount: number;
  loyaltyProgress: number; // X out of 10
};

export async function GET(req: NextRequest) {
  // Protégé admin uniquement — données PII (noms, téléphones, courriels).
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    // Pagination côté serveur — Supabase plafonne à 1000 rows par requête.
    // On boucle avec .range() pour récupérer TOUS les bookings, dans le MÊME
    // ordre que /api/bookings (date asc, time asc) afin que `bks[0]` (le RDV
    // "latest" dont on tire nom/téléphone/courriel) soit identique à avant.
    const PAGE_SIZE = 1000;
    const all: Booking[] = [];
    let from = 0;
    while (true) {
      const { data: page, error: pageErr } = await supabase
        .from("bookings")
        .select("*")
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (pageErr) return NextResponse.json({ error: pageErr.message }, { status: 500 });
      if (!page || page.length === 0) break;
      all.push(...(page as Booking[]));
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
      // Garde-fou: éviter boucle infinie
      if (from > 50000) break;
    }

    // ── Agrégation identique à la page ────────────────────────────────
    const map = new Map<string, Booking[]>();
    for (const b of all) {
      const key = (b.client_email || b.client_phone || "").toLowerCase();
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }

    const stats: ClientStats[] = [];
    for (const [, bks] of map) {
      const verified = bks.filter((b) => b.loyalty_counted === true);
      const noShows = bks.filter((b) => b.status === "no_show");
      const lastVerified =
        verified
          .map((b) => b.date)
          .sort()
          .reverse()[0] || "";
      const latest = bks[0];

      stats.push({
        name: latest.client_name,
        phone: latest.client_phone || "",
        email: latest.client_email || "",
        totalVisits: verified.length,
        totalSpent: verified.reduce((sum, b) => sum + (b.price || 0), 0),
        lastVisit: lastVerified,
        noShowCount: noShows.length,
        loyaltyProgress: verified.length === 0 ? 0 : (verified.length % 10) || 10,
      });
    }

    // Tri par défaut de la page : totalVisits desc.
    stats.sort((a, b) => b.totalVisits - a.totalVisits);

    return NextResponse.json(stats);
  } catch (e) {
    console.error("Client-stats GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
