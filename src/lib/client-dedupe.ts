import { supabaseAdmin } from "@/lib/supabase";

/** Normalise un email (lowercase + trim). */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

/** Normalise un téléphone — garde uniquement les 10 derniers chiffres. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Vérifie si un client est revenu après une date donnée.
 * Recherche par téléphone OU email normalisés, croisé sur tous les bookings.
 * Évite les faux négatifs causés par formats différents (espace, majuscules, etc).
 */
export async function hasClientReturnedSince(
  clientPhone: string | null,
  clientEmail: string | null,
  cutoffDate: string,
  clientName?: string
): Promise<boolean> {
  const normPhone = normalizePhone(clientPhone);
  const normEmail = normalizeEmail(clientEmail);

  if (!normPhone && !normEmail) return false;

  // Récupérer tous les bookings après cutoff (avec pagination défensive)
  const candidates: { client_phone: string | null; client_email: string | null; client_name: string }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("client_phone, client_email, client_name")
      .gt("date", cutoffDate)
      .in("status", ["confirmed", "completed"])
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    candidates.push(...data);
    if (data.length < 1000) break;
    from += 1000;
    if (from > 20000) break;
  }

  for (const b of candidates) {
    const candPhone = normalizePhone(b.client_phone);
    const candEmail = normalizeEmail(b.client_email);
    if (normPhone && candPhone === normPhone) return true;
    if (normEmail && candEmail === normEmail) return true;
    if (clientName && b.client_name && clientName.trim().toLowerCase() === b.client_name.trim().toLowerCase()) return true;
  }

  return false;
}
