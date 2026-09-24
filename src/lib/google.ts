async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export type GmbReview = {
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

export async function fetchGoogleReviews(): Promise<{ reviews: GmbReview[]; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const locationName = process.env.GOOGLE_LOCATION_NAME!;
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = (await res.text()).trim();
      return { reviews: [], error: body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { reviews: data.reviews || [] };
  } catch (e) {
    return { reviews: [], error: String(e) };
  }
}

export async function replyToGoogleReview(reviewName: string, comment: string): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${await res.text()}` };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Trouve automatiquement le nom de ressource de la fiche ("accounts/x/locations/y") —
 * GOOGLE_LOCATION_NAME s'est avéré contenir juste un retour à la ligne (mal configuré),
 * donc on ne s'y fie plus : on redécouvre à chaque fois via l'API (peu coûteux, 2 appels).
 */
async function findLocationName(accessToken: string): Promise<{ name?: string; error?: string }> {
  const acctRes = await fetch("https://mybusiness.googleapis.com/v4/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const acctData = await acctRes.json();
  if (!acctRes.ok) return { error: `comptes: HTTP ${acctRes.status} ${JSON.stringify(acctData).slice(0, 200)}` };
  const accountName = acctData.accounts?.[0]?.name;
  if (!accountName) return { error: "aucun compte Google Business trouvé" };

  const locRes = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const locData = await locRes.json();
  if (!locRes.ok) return { error: `fiches: HTTP ${locRes.status} ${JSON.stringify(locData).slice(0, 200)}` };
  const locationName = locData.locations?.[0]?.name;
  if (!locationName) return { error: "aucune fiche trouvée sur ce compte" };
  return { name: locationName };
}

/**
 * Met à jour l'adresse (déménagement) sur la fiche Google Business Profile.
 * Utilise l'API v4 "mybusiness" — c'est la seule famille pour laquelle le scope OAuth
 * existant a été accordé (les avis/posts l'utilisent déjà avec succès) ; les nouvelles
 * APIs "split" (Business Information v1, Account Management v1) renvoient 403 scope
 * insuffisant avec ce même token.
 */
export async function updateGoogleBusinessAddress(address: {
  addressLines: string[];
  locality: string;
  postalCode: string;
  administrativeArea: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const found = await findLocationName(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable" };

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${found.name}?updateMask=address`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            addressLines: address.addressLines,
            locality: address.locality,
            postalCode: address.postalCode,
            administrativeArea: address.administrativeArea,
            regionCode: "CA",
          },
        }),
      }
    );
    if (!res.ok) return { success: false, error: `HTTP ${res.status} (${found.name}): ${await res.text()}` };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function postToGoogleMyBusiness(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const locationName = process.env.GOOGLE_LOCATION_NAME!;

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languageCode: "fr",
          summary: text,
          topicType: "STANDARD",
          callToAction: {
            actionType: "BOOK",
            url: "https://ciseaunoirbarbershop.com/booking",
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: JSON.stringify(err) };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Coordonnées exactes du local (2275 Avenue Royale, Courville) — vérifiées par géocodage. */
export const SHOP_LATLNG = { latitude: 46.883758, longitude: -71.159241 };

/**
 * Lit ce que Google a VRAIMENT stocké sur la fiche : adresse + pin (latlng).
 * Sert à diagnostiquer le cas « l'adresse est changée mais l'itinéraire mène
 * encore à l'ancien local » : Google garde alors l'ancien pin, qui est ce que
 * le bouton « Itinéraire » utilise (pas le texte de l'adresse).
 */
export async function getGoogleBusinessLocation(): Promise<{
  success: boolean;
  name?: string;
  address?: unknown;
  latlng?: { latitude?: number; longitude?: number };
  pinDistanceMeters?: number;
  raw?: unknown;
  error?: string;
}> {
  try {
    const accessToken = await getAccessToken();
    const found = await findLocationName(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable" };

    const res = await fetch(`https://mybusiness.googleapis.com/v4/${found.name}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };

    const latlng = data.latlng as { latitude?: number; longitude?: number } | undefined;
    return {
      success: true,
      name: found.name,
      address: data.address,
      latlng,
      pinDistanceMeters:
        latlng?.latitude != null && latlng?.longitude != null
          ? metersBetween(latlng.latitude, latlng.longitude, SHOP_LATLNG.latitude, SHOP_LATLNG.longitude)
          : undefined,
      raw: {
        locationName: data.locationName,
        primaryPhone: data.primaryPhone,
        websiteUrl: data.websiteUrl,
        mapsUrl: data.metadata?.mapsUrl,
        placeId: data.locationKey?.placeId,
        hasPendingEdits: data.metadata?.hasPendingEdits,
        canModifyServiceList: data.metadata?.canModifyServiceList,
        openInfo: data.openInfo,
      },
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Distance approximative en mètres entre deux points (formule haversine). */
function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Déplace le pin de la fiche Google sur les vraies coordonnées du local.
 * C'est CE champ que « Itinéraire » suit — changer le texte de l'adresse ne
 * le bouge pas toujours (Google conserve l'ancien point géocodé).
 */
export async function updateGoogleBusinessPin(
  lat: number = SHOP_LATLNG.latitude,
  lng: number = SHOP_LATLNG.longitude
): Promise<{ success: boolean; error?: string; result?: unknown }> {
  try {
    const accessToken = await getAccessToken();
    const found = await findLocationName(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable" };

    const res = await fetch(`https://mybusiness.googleapis.com/v4/${found.name}?updateMask=latlng`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ latlng: { latitude: lat, longitude: lng } }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, result: { latlng: data.latlng, hasPendingEdits: data.metadata?.hasPendingEdits } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
