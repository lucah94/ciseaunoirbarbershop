/**
 * Résolution + validation TOLÉRANTE d'un nom de service vers son prix officiel.
 * Source de vérité : table Supabase `services`. Fallback : prix canoniques embarqués.
 *
 * But (qualité production) : empêcher les 2 bugs trouvés en simulation —
 *  (1) un prix inventé / fallback aveugle à 35$ sur un typo,
 *  (2) un service inexistant créé par un bot.
 * Si aucun service ne correspond → matched:false : le bot DOIT refuser/clarifier, pas inventer.
 */
import { supabaseAdmin } from "@/lib/supabase";

const FALLBACK_PRICES: Record<string, number> = {
  "coupe + lavage": 35,
  "coupe + barbe a la lame": 50,
  "coupe + barbe shaver": 45,
  "service premium": 75,
  "rasage / barbe": 25,
  "enfant (12 ans et moins)": 30,
};

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export type ServiceMatch = { name: string; price: number; matched: boolean };

/** Retourne le service officiel + son prix, ou matched:false si introuvable (ne JAMAIS inventer). */
export async function resolveService(input: string): Promise<ServiceMatch> {
  const target = norm(input);
  if (!target) return { name: input, price: 0, matched: false };

  // 1. Table `services` (source de vérité)
  try {
    const { data } = await supabaseAdmin.from("services").select("name, price, active");
    const rows = (data || []).filter((r) => (r as { active?: boolean }).active !== false) as {
      name: string;
      price: number;
    }[];
    let hit = rows.find((r) => norm(r.name) === target);
    if (!hit) hit = rows.find((r) => norm(r.name).includes(target) || target.includes(norm(r.name)));
    if (hit) return { name: hit.name, price: Number(hit.price) || 0, matched: true };
  } catch {
    /* on tombe sur le fallback */
  }

  // 2. Fallback embarqué (prix canoniques)
  let key = Object.keys(FALLBACK_PRICES).find((k) => k === target);
  if (!key) key = Object.keys(FALLBACK_PRICES).find((k) => k.includes(target) || target.includes(k));
  if (key) return { name: input, price: FALLBACK_PRICES[key], matched: true };

  // 3. Aucun match → le bot doit refuser/clarifier
  return { name: input, price: 0, matched: false };
}
