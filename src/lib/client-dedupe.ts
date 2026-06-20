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

/** Vérificateur synchrone : un client est-il revenu après le cutoff ? */
export type ReturnedChecker = (
  clientPhone: string | null,
  clientEmail: string | null,
  clientName?: string
) => boolean;

/**
 * Charge UNE seule fois tous les bookings après `cutoffDate` et construit des
 * Sets normalisés (téléphone/email/nom). Retourne un vérificateur synchrone à
 * appeler par-client en mémoire, évitant le N+1 (une requête par client).
 * Comportement identique à `hasClientReturnedSince` : match phone OU email OU nom.
 */
export async function buildReturnedChecker(cutoffDate: string): Promise<ReturnedChecker> {
  // Récupérer tous les bookings après cutoff (avec pagination défensive)
  const phones = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();
  let from = 0;
  while (true) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("client_phone, client_email, client_name")
      .gt("date", cutoffDate)
      .in("status", ["confirmed", "completed"])
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const b of data) {
      const candPhone = normalizePhone(b.client_phone);
      const candEmail = normalizeEmail(b.client_email);
      if (candPhone) phones.add(candPhone);
      if (candEmail) emails.add(candEmail);
      if (b.client_name) names.add(b.client_name.trim().toLowerCase());
    }
    if (data.length < 1000) break;
    from += 1000;
    if (from > 20000) break;
  }

  return (clientPhone, clientEmail, clientName) => {
    const normPhone = normalizePhone(clientPhone);
    const normEmail = normalizeEmail(clientEmail);
    if (!normPhone && !normEmail) return false;
    if (normPhone && phones.has(normPhone)) return true;
    if (normEmail && emails.has(normEmail)) return true;
    if (clientName && names.has(clientName.trim().toLowerCase())) return true;
    return false;
  };
}

/**
 * Vérifie si un client est revenu après une date donnée.
 * Wrapper de compatibilité : délègue à `buildReturnedChecker`. Pour vérifier
 * plusieurs clients sur le même cutoff, préférez `buildReturnedChecker` (1 requête).
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

  const check = await buildReturnedChecker(cutoffDate);
  return check(clientPhone, clientEmail, clientName);
}
