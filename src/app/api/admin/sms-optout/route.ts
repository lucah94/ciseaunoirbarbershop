import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { phoneKey } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * Gestion de la liste de désinscription SMS (« blacklist ») depuis /admin/clients.
 *
 * - GET    : liste des numéros désinscrits, enrichie du nom du client.
 * - POST   : Melynda retire un client des SMS (source = 'admin').
 * - DELETE : Melynda réinscrit un client (retire sa ligne de la blacklist).
 *
 * La table `sms_blacklist` ne contient QUE de vraies désinscriptions — le
 * journal winback vit dans `sms_winback_log` et ne bloque aucun envoi.
 * On ne supprime jamais un client de la base : bloquer = ajouter une ligne ici.
 */

type OptOutRow = { phone: string; source: string | null; note: string | null; created_at: string | null };

/** Construit une table numéro(10 chiffres) → nom, à partir de `clients` puis `bookings`. */
async function buildNameMap(keys: Set<string>): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (keys.size === 0) return names;

  const absorb = (rows: { name?: string | null; client_name?: string | null; phone?: string | null; client_phone?: string | null }[]) => {
    for (const r of rows) {
      const k = (r.phone ?? r.client_phone ?? "").replace(/\D/g, "").slice(-10);
      if (!k || !keys.has(k) || names.has(k)) continue;
      const n = (r.name ?? r.client_name ?? "").trim();
      if (n) names.set(k, n);
    }
  };

  const PAGE = 1000;

  // 1) Table clients (source de vérité des coordonnées)
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await supabase
      .from("clients")
      .select("name, phone")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    absorb(data);
    if (data.length < PAGE || names.size >= keys.size) break;
  }

  // 2) Complément via l'historique des RDV pour les numéros encore sans nom
  if (names.size < keys.size) {
    for (let from = 0; from < 60000; from += PAGE) {
      const { data, error } = await supabase
        .from("bookings")
        .select("client_name, client_phone")
        .order("date", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      absorb(data);
      if (data.length < PAGE || names.size >= keys.size) break;
    }
  }

  return names;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("sms_blacklist")
    .select("phone, source, note, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as OptOutRow[];
  const keys = new Set(rows.map((r) => r.phone.replace(/\D/g, "").slice(-10)));
  const names = await buildNameMap(keys);

  const optOuts = rows.map((r) => {
    const key = r.phone.replace(/\D/g, "").slice(-10);
    return {
      phone: key,
      name: names.get(key) ?? null,
      source: r.source ?? "client",
      note: r.note ?? null,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ optOuts, count: optOuts.length });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { phone?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const key = phoneKey(body.phone ?? "");
  if (key.length !== 10) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });

  const { error } = await supabase.from("sms_blacklist").upsert(
    { phone: key, source: "admin", note: body.note?.trim() || null, created_at: new Date().toISOString() },
    { onConflict: "phone" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, phone: key });
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const key = phoneKey(body.phone ?? "");
  if (key.length !== 10) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });

  const { error } = await supabase.from("sms_blacklist").delete().eq("phone", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, phone: key });
}
