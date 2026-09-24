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

export async function updateGoogleBusinessAddress(address: {
  addressLines: string[];
  locality: string;
  postalCode: string;
  administrativeArea: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const found = await discoverLocation(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable" };

    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${found.name}?updateMask=storefrontAddress`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          storefrontAddress: {
            addressLines: address.addressLines,
            locality: address.locality,
            postalCode: address.postalCode,
            administrativeArea: address.administrativeArea,
            regionCode: "CA",
            languageCode: "fr",
          },
        }),
      }
    );
    const body = await readBody(res);
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${body.json ? JSON.stringify(body.json).slice(0, 400) : body.text}` };
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

/** Lit une réponse HTTP sans jamais planter : Google renvoie parfois du HTML (API retirée). */
async function readBody(res: Response): Promise<{ json?: Record<string, unknown>; text: string }> {
  const text = (await res.text()).slice(0, 4000);
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { text: text.replace(/\s+/g, " ").slice(0, 300) };
  }
}

type Trace = { etape: string; status: number; detail?: string };

/**
 * Trouve la fiche via les APIs ACTUELLES de Google Business Profile.
 * L'ancienne "mybusiness v4" ne sert plus qu'aux avis/posts : sa liste de comptes
 * répond du HTML (API retirée), ce qui faisait échouer toute mise à jour d'adresse
 * en silence. On passe donc par Account Management v1 + Business Information v1,
 * avec repli sur v4 si jamais le scope OAuth ne couvre que l'ancienne famille.
 */
async function discoverLocation(accessToken: string): Promise<{
  name?: string;
  storefrontAddress?: unknown;
  latlng?: { latitude?: number; longitude?: number };
  metadata?: Record<string, unknown>;
  title?: string;
  trace: Trace[];
  error?: string;
}> {
  const trace: Trace[] = [];
  const h = { Authorization: `Bearer ${accessToken}` };

  const accRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: h });
  const acc = await readBody(accRes);
  trace.push({ etape: "comptes v1", status: accRes.status, detail: acc.json ? undefined : acc.text });

  const accounts = (acc.json?.accounts as { name?: string }[] | undefined) || [];
  if (!accRes.ok || accounts.length === 0) {
    return { trace, error: `aucun compte lisible (HTTP ${accRes.status})` };
  }

  const readMask = "name,title,storefrontAddress,latlng,metadata";
  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=${readMask}&pageSize=20`,
      { headers: h }
    );
    const loc = await readBody(locRes);
    trace.push({ etape: `fiches de ${account.name}`, status: locRes.status, detail: loc.json ? undefined : loc.text });
    const locations = (loc.json?.locations as Record<string, unknown>[] | undefined) || [];
    if (locations.length > 0) {
      const l = locations[0];
      return {
        name: l.name as string,
        title: l.title as string,
        storefrontAddress: l.storefrontAddress,
        latlng: l.latlng as { latitude?: number; longitude?: number } | undefined,
        metadata: l.metadata as Record<string, unknown>,
        trace,
      };
    }
  }
  return { trace, error: "aucune fiche trouvée sur les comptes accessibles" };
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
 * Lit ce que Google a VRAIMENT stocké sur la fiche : adresse + pin (latlng).
 * Le bouton « Itinéraire » suit le pin, pas le texte de l'adresse — c'est pour ça
 * qu'une adresse corrigée à la main peut quand même envoyer les clients au vieux local.
 */
export async function getGoogleBusinessLocation(): Promise<{
  success: boolean;
  name?: string;
  address?: unknown;
  latlng?: { latitude?: number; longitude?: number };
  pinDistanceMeters?: number;
  raw?: unknown;
  trace?: Trace[];
  error?: string;
}> {
  try {
    const accessToken = await getAccessToken();
    const found = await discoverLocation(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable", trace: found.trace };

    const latlng = found.latlng;
    return {
      success: true,
      name: found.name,
      address: found.storefrontAddress,
      latlng,
      pinDistanceMeters:
        latlng?.latitude != null && latlng?.longitude != null
          ? metersBetween(latlng.latitude, latlng.longitude, SHOP_LATLNG.latitude, SHOP_LATLNG.longitude)
          : undefined,
      raw: { titre: found.title, metadata: found.metadata },
      trace: found.trace,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Déplace le pin de la fiche Google sur les vraies coordonnées du local. */
export async function updateGoogleBusinessPin(
  lat: number = SHOP_LATLNG.latitude,
  lng: number = SHOP_LATLNG.longitude
): Promise<{ success: boolean; error?: string; result?: unknown }> {
  try {
    const accessToken = await getAccessToken();
    const found = await discoverLocation(accessToken);
    if (!found.name) return { success: false, error: found.error || "fiche introuvable" };

    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${found.name}?updateMask=latlng`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ latlng: { latitude: lat, longitude: lng } }),
      }
    );
    const body = await readBody(res);
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${body.json ? JSON.stringify(body.json).slice(0, 400) : body.text}` };
    return { success: true, result: { latlng: body.json?.latlng } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
