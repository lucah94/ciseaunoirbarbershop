import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { imageUrl, platform } = await req.json();

  if (!imageUrl) return NextResponse.json({ error: "URL d'image requise pour une story" }, { status: 400 });

  try {
    const results: Record<string, unknown> = {};

    // Facebook Story
    if (platform === "facebook" || platform === "both") {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${PAGE_ID}/photo_stories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl, access_token: TOKEN }),
        }
      );
      const data = await res.json();
      results.facebook = data.error ? { error: data.error.message } : { ok: true, id: data.id };
    }

    // Instagram Story
    if ((platform === "instagram" || platform === "both") && process.env.INSTAGRAM_ACCOUNT_ID) {
      const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
      // Step 1: Create story container
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl, media_type: "STORIES", access_token: TOKEN }),
        }
      );
      const container = await containerRes.json();
      if (!container.error && container.id) {
        const publishRes = await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: container.id, access_token: TOKEN }),
          }
        );
        const pub = await publishRes.json();
        results.instagram = pub.error ? { error: pub.error.message } : { ok: true, id: pub.id };
      } else {
        results.instagram = { error: container.error?.message };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
