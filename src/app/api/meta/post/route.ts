import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getFacebookToken, refreshFacebookToken, isFbTokenError } from "@/lib/fbToken";
export const dynamic = 'force-dynamic';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { message, imageUrl, publishToInstagram } = await req.json();

  if (!message) return NextResponse.json({ error: "Message requis" }, { status: 400 });

  // Token de page auto-réparé (re-dérivé depuis le System User token au besoin).
  let TOKEN = await getFacebookToken();

  try {
    let photoId: string | null = null;

    // If image, upload it first
    if (imageUrl) {
      const doUpload = async (tok: string) => {
        const r = await fetch(
          `https://graph.facebook.com/v19.0/${PAGE_ID}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: imageUrl, caption: message, access_token: tok, published: true }),
          }
        );
        return (await r.json()) as { id?: string; error?: { message?: string; code?: number; type?: string } };
      };
      let uploadData = await doUpload(TOKEN);
      // AUTO-RÉPARATION : token mort → re-dérive + réessaie une fois.
      if (uploadData.error && isFbTokenError(uploadData.error)) {
        const fresh = await refreshFacebookToken();
        if (fresh) { TOKEN = fresh; uploadData = await doUpload(TOKEN); }
      }
      if (uploadData.error) return NextResponse.json({ error: uploadData.error.message }, { status: 400 });
      photoId = uploadData.id ?? null;
    } else {
      // Text post
      const doFeed = async (tok: string) => {
        const r = await fetch(
          `https://graph.facebook.com/v19.0/${PAGE_ID}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, access_token: tok }),
          }
        );
        return (await r.json()) as { id?: string; error?: { message?: string; code?: number; type?: string } };
      };
      let data = await doFeed(TOKEN);
      // AUTO-RÉPARATION : token mort → re-dérive + réessaie une fois.
      if (data.error && isFbTokenError(data.error)) {
        const fresh = await refreshFacebookToken();
        if (fresh) { TOKEN = fresh; data = await doFeed(TOKEN); }
      }
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

      // Publish to Instagram if requested
      if (publishToInstagram && process.env.INSTAGRAM_ACCOUNT_ID) {
        // Instagram requires media (image), skip for text-only
      }

      return NextResponse.json({ ok: true, id: data.id });
    }

    // Publish to Instagram if image + IG account
    if (publishToInstagram && process.env.INSTAGRAM_ACCOUNT_ID && imageUrl) {
      const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
      // Step 1: Create container
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl, caption: message, access_token: TOKEN }),
        }
      );
      const container = await containerRes.json();
      if (!container.error && container.id) {
        // Step 2: Publish
        await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: container.id, access_token: TOKEN }),
          }
        );
      }
    }

    return NextResponse.json({ ok: true, id: photoId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
