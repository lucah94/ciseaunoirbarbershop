import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

/**
 * SÉCURITÉ : ce GET ne MUTE plus rien.
 * Avant, il annulait le RDV au simple chargement de l'URL (supabase update sur GET) — donc
 * un prefetch de lien ou un scanner/antivirus de courriel pouvait annuler un VRAI rendez-vous
 * sans que le client clique. Il exposait aussi nom+tél du client dans la page HTML.
 * Désormais on redirige vers la page de confirmation /booking/cancel, où l'annulation se fait
 * par un clic explicite (bouton → PATCH), jamais sur un simple GET.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
  return NextResponse.redirect(`${base}/booking/cancel?id=${encodeURIComponent(id)}`, 302);
}
