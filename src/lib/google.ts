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
