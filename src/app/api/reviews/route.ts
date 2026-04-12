import { NextResponse } from "next/server";

export const revalidate = 86400; // Cache 24h

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&language=fr&key=${apiKey}`,
    { next: { revalidate: 86400 } }
  );

  const data = await res.json();

  if (data.status !== "OK") {
    return NextResponse.json({ error: data.status }, { status: 500 });
  }

  return NextResponse.json({
    reviews: data.result.reviews ?? [],
    rating: data.result.rating,
    total: data.result.user_ratings_total,
  });
}
