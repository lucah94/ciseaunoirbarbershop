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
