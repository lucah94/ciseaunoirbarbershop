import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getGoogleBusinessLocation,
  updateGoogleBusinessPin,
  updateGoogleBusinessAddress,
  SHOP_LATLNG,
} from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * Déménagement — cas « l'adresse est bonne sur la fiche Google mais
 * Itinéraire mène encore à l'ancien local ».
 *
 * Le bouton « Itinéraire » de Google suit le PIN (latlng) de la fiche, pas le
 * texte de l'adresse. Quand on corrige l'adresse à la main, Google garde
 * souvent l'ancien point géocodé : le client se fait envoyer au vieux local.
 *
 * GET  → ce que Google stocke réellement (adresse + pin + distance au vrai local)
 * POST → replace le pin (et re-pousse l'adresse) sur les bonnes coordonnées
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const loc = await getGoogleBusinessLocation();
  const off = loc.pinDistanceMeters;
  return NextResponse.json({
    ok: loc.success,
    attendu: SHOP_LATLNG,
    pinGoogle: loc.latlng ?? null,
    ecartMetres: off ?? null,
    verdict: !loc.success
      ? "lecture impossible — voir erreur"
      : off == null
        ? "aucun pin lisible sur la fiche"
        : off > 150
          ? `PIN À L'ANCIEN LOCAL (${off} m d'écart) — c'est ça qui casse l'itinéraire`
          : `pin correct (${off} m d'écart)`,
    adresseGoogle: loc.address ?? null,
    fiche: loc.raw ?? null,
    name: loc.name ?? null,
    // Codes HTTP de chaque étape : distingue "API pas activée dans le projet Google"
    // d'un "scope OAuth insuffisant" — les deux donnent 403 mais ne se règlent pas pareil.
    trace: loc.trace ?? null,
    error: loc.error,
  }, { status: loc.success ? 200 : 502 });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const avant = await getGoogleBusinessLocation();
  const pin = await updateGoogleBusinessPin();
  const adresse = await updateGoogleBusinessAddress({
    addressLines: ["2275 Avenue Royale"],
    locality: "Québec",
    postalCode: "G1C 1P5",
    administrativeArea: "QC",
  });
  const apres = await getGoogleBusinessLocation();

  const ok = pin.success;
  return NextResponse.json({
    ok,
    pin: pin.success ? { ok: true, ...(pin.result as object) } : { ok: false, error: pin.error },
    adresse: adresse.success ? { ok: true } : { ok: false, error: adresse.error },
    avant: { latlng: avant.latlng ?? null, ecartMetres: avant.pinDistanceMeters ?? null },
    apres: { latlng: apres.latlng ?? null, ecartMetres: apres.pinDistanceMeters ?? null },
    note: ok
      ? "Google peut mettre quelques heures à propager le nouveau pin (et le remettre en révision)."
      : "Échec API — le pin doit alors être déplacé à la main dans la fiche Google (Modifier le profil → Adresse → position sur la carte).",
  }, { status: ok ? 200 : 502 });
}
