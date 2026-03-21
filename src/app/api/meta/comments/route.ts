import { NextRequest, NextResponse } from "next/server";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");

  try {
    if (postId) {
      // Get comments for a specific post
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,message,from,created_time,can_hide,like_count&access_token=${TOKEN}`
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json(data.data || []);
    } else {
      // Get recent posts with comment counts
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${PAGE_ID}/posts?fields=id,message,created_time,full_picture,comments.summary(true),reactions.summary(true)&limit=10&access_token=${TOKEN}`
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json(data.data || []);
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
